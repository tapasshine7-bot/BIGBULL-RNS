// RNS BIGBULL hidden admin console (backed by D1).
// Endpoints: POST/GET /api/admin/* — require x-admin-token header (session).
// Public mirror: GET /api/banner — returns active banner + maintenance state.

import { generateMemberKey } from "./index";

// Portable base64 encoder for binary data stored in site_config.
function uint8ToBase64(data: Uint8Array): string {
  let bin = "";
  const chunk = 8192;
  for (let i = 0; i < data.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(data.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

export interface AdminContext {
  db: D1Database;
}

// ---------------------------------------------------------------------------
// Schema bootstrap (idempotent)
// ---------------------------------------------------------------------------

const ADMIN_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_credential (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     username TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     salt_hex TEXT NOT NULL,
     recovery_hash TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     token TEXT NOT NULL UNIQUE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS site_config (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     actor TEXT NOT NULL,
     action TEXT NOT NULL,
     entity TEXT NOT NULL,
     metadata_json TEXT NOT NULL,
     severity TEXT NOT NULL DEFAULT 'info',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS monitor_targets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     url TEXT NOT NULL,
     enabled INTEGER NOT NULL DEFAULT 1,
     warning_ms INTEGER NOT NULL DEFAULT 2000,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS monitor_results (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     target_id INTEGER NOT NULL,
     status TEXT NOT NULL,
     latency_ms INTEGER,
     status_code INTEGER,
     error TEXT,
     checked_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS incidents (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     severity TEXT NOT NULL DEFAULT 'warning',
     status TEXT NOT NULL DEFAULT 'open',
     note TEXT,
     created_at TEXT NOT NULL,
     resolved_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS notifications (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     text TEXT NOT NULL,
     severity TEXT NOT NULL DEFAULT 'info',
     is_read INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   )`,
  // Manual announcements posted by the admin — shown in the site Activity feed.
  `CREATE TABLE IF NOT EXISTS announcements (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     body TEXT,
     severity TEXT NOT NULL DEFAULT 'info',
     pinned INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     expires_at TEXT
   )`,
  // Visitor tool-request submissions (free, stored, reviewed in admin).
  `CREATE TABLE IF NOT EXISTS tool_requests (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     detail TEXT,
     contact TEXT,
     status TEXT NOT NULL DEFAULT 'open',
     created_at TEXT NOT NULL
   )`,
  // Per-page visit counters (unique-device, day-bucketed, anonymous).
  `CREATE TABLE IF NOT EXISTS visit_counters (
     day TEXT NOT NULL,
     path TEXT NOT NULL,
     device TEXT NOT NULL,
     requests INTEGER NOT NULL DEFAULT 1,
     PRIMARY KEY (day, path, device)
   )`,
  // Tool ordering preferences in VIP Hub (tool_id -> display position).
  `CREATE TABLE IF NOT EXISTS tool_ordering (
     tool_id TEXT PRIMARY KEY,
     position INTEGER NOT NULL DEFAULT 99,
     updated_at TEXT NOT NULL
   )`,
  // Lifetime VIP members identified by a unique key (no accounts, no login).
  `CREATE TABLE IF NOT EXISTS vip_members (
     member_key TEXT PRIMARY KEY,
     display_name TEXT NOT NULL,
     email TEXT,
     status TEXT NOT NULL DEFAULT 'registered',
     paid_at TEXT,
     approved_at TEXT,
     created_at TEXT NOT NULL
   )`,
  // ₹20 payment requests submitted by members — admin approves manually.
  `CREATE TABLE IF NOT EXISTS vip_payments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     member_key TEXT NOT NULL,
     display_name TEXT NOT NULL,
     amount INTEGER NOT NULL DEFAULT 20,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TEXT NOT NULL
   )`,
  // VIP members blocked by the admin (wrongly approved without payment etc.).
  // Blocked members are kicked to the main dashboard and must pay again.
  `CREATE TABLE IF NOT EXISTS vip_blocks (
     member_key TEXT PRIMARY KEY,
     reason TEXT,
     blocked_at TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  // Manually seeded Free Fire UID profiles (live lookup is intermittently
  // blocked upstream, so admin can guarantee a profile always resolves).
  `CREATE TABLE IF NOT EXISTS uid_seed (
     uid TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     region TEXT NOT NULL DEFAULT 'IND',
     created_at TEXT NOT NULL
   )`,
];

async function ensureSchema(db: D1Database): Promise<void> {
  const batch = ADMIN_SCHEMA.map((sql) => db.prepare(sql));
  await db.batch(batch);
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashWithSalt(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltHex), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CredentialRow {
  id: number;
  username: string;
  password_hash: string;
  salt_hex: string;
  recovery_hash: string;
  updated_at: string;
}

async function readCredential(db: D1Database): Promise<CredentialRow | null> {
  const row = await db.prepare("SELECT * FROM admin_credential WHERE id = 1").first<CredentialRow>();
  return (row ?? null) as CredentialRow | null;
}

async function seedCredential(db: D1Database, username: string, password: string, recovery: string): Promise<void> {
  const saltHex = randomHex(16);
  const passwordHash = await hashWithSalt(password, saltHex);
  const recoveryKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(recovery.toLowerCase()));
  const recoveryHash = Array.from(new Uint8Array(recoveryKey)).map((b) => b.toString(16).padStart(2, "0")).join("");
  await db
    .prepare(
      "INSERT OR REPLACE INTO admin_credential (id, username, password_hash, salt_hex, recovery_hash, updated_at) VALUES (1, ?, ?, ?, ?, ?)",
    )
    .bind(username, passwordHash, saltHex, recoveryHash, new Date().toISOString())
    .run();
}

export const ADMIN_USERNAME = "Tapas123";
export const ADMIN_PASSWORD = "Tapas@1234";
export const ADMIN_RECOVERY = "rnsbull-1234";

async function verifyPassword(db: D1Database, password: string): Promise<boolean> {
  let cred = await readCredential(db);
  if (!cred) {
    await seedCredential(db, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_RECOVERY);
    cred = await readCredential(db);
    if (!cred) return false;
  }
  const hash = await hashWithSalt(password, cred.salt_hex);
  return secureEqual(hash, cred.password_hash);
}

async function verifyRecovery(db: D1Database, recovery: string): Promise<boolean> {
  const cred = await readCredential(db);
  if (!cred) return false;
  const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(recovery.toLowerCase()));
  const hash = Array.from(new Uint8Array(key)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return secureEqual(hash, cred.recovery_hash);
}

async function createSession(db: D1Database): Promise<string> {
  const token = randomHex(24);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .prepare("INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(token, now.toISOString(), expires.toISOString())
    .run();
  return token;
}

async function resolveSession(db: D1Database, token: string | null): Promise<boolean> {
  if (!token) return false;
  const row = await db
    .prepare("SELECT expires_at FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first<{ expires_at: string }>();
  if (!row) return false;
  // Rolling expiry for smooth long sessions.
  await db
    .prepare("UPDATE admin_sessions SET expires_at = datetime('now', '+7 days') WHERE token = ?")
    .bind(token)
    .run();
  return true;
}

// ---------------------------------------------------------------------------
// Audit + notifications
// ---------------------------------------------------------------------------

async function audit(db: D1Database, actor: string, action: string, entity: string, metadata: unknown, severity = "info"): Promise<void> {
  await db
    .prepare("INSERT INTO audit_log (actor, action, entity, metadata_json, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(actor, action, entity, JSON.stringify(metadata ?? {}), severity, new Date().toISOString())
    .run();
}

async function notify(db: D1Database, text: string, severity = "info"): Promise<void> {
  await db
    .prepare("INSERT INTO notifications (text, severity, created_at) VALUES (?, ?, ?)")
    .bind(text, severity, new Date().toISOString())
    .run();
}

// ---------------------------------------------------------------------------
// Banner + maintenance (site-wide public state)
// ---------------------------------------------------------------------------

interface BannerState {
  text: string;
  expiresAt: string | null;
  startsAt: string | null; // ISO timestamp — banner only shows from this moment
}

function defaultBannerState(): BannerState {
  return { text: "", expiresAt: null, startsAt: null };
}

type MaintenanceScope = "both" | "bio" | "vip";
type MaintenanceMode = "maintenance" | "update";

interface MaintenanceState {
  enabled: boolean;
  message: string;
  scope: MaintenanceScope;
  mode: MaintenanceMode; // "maintenance" or "update" — both lock the scoped tools
  scheduledEnd: string | null; // ISO timestamp — auto-ends at this moment
}

async function readBanner(db: D1Database): Promise<BannerState | null> {
  const row = await db.prepare("SELECT value FROM site_config WHERE key = 'active_banner'").first<{ value: string }>();
  if (!row) return null;
  try {
    const parsed: BannerState = JSON.parse(row.value);
    const now = Date.now();
    if (parsed.startsAt) {
      const start = new Date(parsed.startsAt);
      if (Number.isFinite(start.valueOf()) && start.getTime() > now) return null;
    }
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date(now)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readMaintenance(db: D1Database): Promise<MaintenanceState> {
  const row = await db.prepare("SELECT value FROM site_config WHERE key = 'maintenance_mode'").first<{ value: string }>();
  if (!row) return { enabled: false, message: "", scope: "both", mode: "maintenance", scheduledEnd: null };
  try {
    const parsed = JSON.parse(row.value) as Partial<MaintenanceState>;
    const scope: MaintenanceScope = parsed.scope === "bio" || parsed.scope === "vip" ? parsed.scope : "both";
    // Auto-end: if a scheduled end is set and it has passed, maintenance switches itself off.
    let enabled = Boolean(parsed.enabled);
    if (enabled && parsed.scheduledEnd) {
      const end = new Date(parsed.scheduledEnd);
      if (Number.isFinite(end.valueOf()) && end.getTime() <= Date.now()) {
        enabled = false;
        const reset: MaintenanceState = { enabled: false, message: String(parsed.message ?? ""), scope, mode: String(parsed.mode) === "update" ? "update" : "maintenance", scheduledEnd: null };
        await writeConfig(db, "maintenance_mode", reset);
        await audit(db, "Tapas123", "maintenance.auto-end", "maintenance", { scope, scheduledEnd: parsed.scheduledEnd }).catch(() => {});
      }
    }
    const mode: MaintenanceMode = String(parsed.mode) === "update" ? "update" : "maintenance";
    return {
      enabled,
      message: String(parsed.message ?? ""),
      scope,
      mode,
      scheduledEnd: enabled ? (parsed.scheduledEnd ?? null) : null,
    };
  } catch {
    return { enabled: false, message: "", scope: "both", mode: "maintenance", scheduledEnd: null };
  }
}

async function writeConfig(db: D1Database, key: string, value: unknown): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES (?, ?, ?)")
    .bind(key, JSON.stringify(value), new Date().toISOString())
    .run();
}

// ---------------------------------------------------------------------------
// Monitoring (safe HTTP checks, SSRF-guarded)
// ---------------------------------------------------------------------------

const PRIVATE_HOST_RE =
  /^(localhost|.*\.local|.*\.localhost|.*\.internal|metadata\.google|.*\.metadata\.google|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.\d+\.\d+\.\d+)$/i;

function classify(statusCode: number | null, latencyMs: number | null, warningMs: number): "green" | "yellow" | "red" {
  if (statusCode === null) return "red";
  if (statusCode >= 200 && statusCode < 300) {
    return latencyMs !== null && latencyMs > warningMs ? "yellow" : "green";
  }
  if (statusCode >= 300 && statusCode < 400) return "yellow";
  return "red";
}

async function checkOneTarget(
  db: D1Database,
  target: { id: number; name: string; url: string; warning_ms: number },
): Promise<{ id: number; status: string; latency_ms: number | null; error: string | null }> {
  try {
    const url = new URL(target.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
    if (PRIVATE_HOST_RE.test(url.hostname)) throw new Error("Private host blocked");
    const start = Date.now();
    const response = await fetch(url.toString(), { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const latency = Date.now() - start;
    const status = classify(response.status, latency, target.warning_ms);
    const result = { id: target.id, status, latency_ms: latency, error: null };
    await db
      .prepare(
        "INSERT INTO monitor_results (target_id, status, latency_ms, status_code, error, checked_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(target.id, result.status, result.latency_ms, response.status, null, new Date().toISOString())
      .run();
    return result;
  } catch (error) {
    const message = (error as { message?: string }).message ?? "check failed";
    const result = { id: target.id, status: "red" as const, latency_ms: null as number | null, error: message };
    await db
      .prepare(
        "INSERT INTO monitor_results (target_id, status, latency_ms, status_code, error, checked_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(target.id, result.status, result.latency_ms, null, result.error, new Date().toISOString())
      .run();
    return result;
  }
}

async function runAllChecks(db: D1Database): Promise<void> {
  const { results: targets } = await db
    .prepare("SELECT * FROM monitor_targets WHERE enabled = 1 ORDER BY id")
    .all<{ id: number; name: string; url: string; warning_ms: number }>();
  const rows = (targets ?? []) as { id: number; name: string; url: string; warning_ms: number }[];
  const outcomes = await Promise.all(rows.map((t) => checkOneTarget(db, t)));
  const redOnes = outcomes.filter((o) => o.status === "red");
  for (const red of redOnes) {
    const target = rows.find((t) => t.id === red.id);
    await notify(db, `Monitor: ${target?.name ?? String(red.id)} is DOWN (${red.error ?? "no response"}).`, "warning");
    // Auto-open incident only if none open for this target today.
    const { results: open } = await db
      .prepare(
        "SELECT id FROM incidents WHERE status = 'open' AND title LIKE ? AND created_at > datetime('now', '-1 day')",
      )
      .bind(`%${target?.name}%`)
      .all<{ id: number }>();
    if (!open || open.length === 0) {
      await db
        .prepare("INSERT INTO incidents (title, severity, status, created_at) VALUES (?, 'warning', 'open', ?)")
        .bind(`Tool offline: ${target?.name ?? String(red.id)} (${red.error ?? "no response"})`, new Date().toISOString())
        .run();
    }
  }
}

// ---------------------------------------------------------------------------
// Session extraction helper
// ---------------------------------------------------------------------------

function adminToken(request: Request): string | null {
  return request.headers.get("x-admin-token");
}

function adminJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeJson(status: number, body: unknown, request: Request): Response {
  const resp = adminJson(status, body);
  // Admin endpoints are same-origin on production; mirror public CORS for dev hosts.
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ["https://rnsbigbull.site", "https://www.rnsbigbull.site", "https://rnsbigbull-site.pages.dev"];
  if (allowed.includes(origin)) {
    resp.headers.set("access-control-allow-origin", origin);
    resp.headers.set("access-control-allow-headers", "content-type, x-admin-token");
  }
  return resp;
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

const ANON = "public-site";

async function recordVisit(db: D1Database, path: string, device: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await db
    .prepare(
      "INSERT INTO visit_counters (day, path, device, requests) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, device) DO UPDATE SET requests = requests + 1",
    )
    .bind(day, path, device)
    .run();
}

function deviceFingerprint(request: Request): string {
  // Anonymous, coarse bucket: browser family + platform. Never stores IPs.
  const ua = request.headers.get("User-Agent") ?? "unknown";
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  if (/Edg\//i.test(ua)) return isMobile ? "mobile-edge" : "desktop-edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return isMobile ? "mobile-opera" : "desktop-opera";
  if (/Chrome/i.test(ua)) return isMobile ? "mobile-chrome" : "desktop-chrome";
  if (/Safari/i.test(ua)) return isMobile ? "mobile-safari" : "desktop-safari";
  if (/Firefox/i.test(ua)) return isMobile ? "mobile-firefox" : "desktop-firefox";
  return isMobile ? "mobile-other" : "desktop-other";
}

export async function handleAdmin(db: D1Database, request: Request, path: string): Promise<Response> {
  await ensureSchema(db);

  const requiresAuth = path !== "/login" && path !== "/banner";
  if (requiresAuth && !(await resolveSession(db, adminToken(request)))) {
    return safeJson(401, { ok: false, error: "Not signed in" }, request);
  }
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
    return safeJson(405, { ok: false, error: "Method not allowed" }, request);
  }

  try {
    // GET /api/admin/banner — public-ish banner+maintenance read for the console
    if (path === "/banner" && request.method === "GET") {
      const banner = await readBanner(db);
      const maintenance = await readMaintenance(db);
      return safeJson(200, { banner, maintenance }, request);
    }

    // POST /api/admin/login
    if (path === "/login" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const password = String((body && (body as { password?: unknown }).password) ?? "");
      const recovery = String((body && (body as { recovery?: unknown }).recovery) ?? "");
      const ok = password ? await verifyPassword(db, password) : recovery ? await verifyRecovery(db, recovery) : false;
      if (!ok) {
        await audit(db, "unknown", "admin.login.failed", "admin", { attempt: password ? "password" : "recovery" }, "warning");
        return safeJson(401, { ok: false, error: "Wrong password or recovery code" }, request);
      }
      const token = await createSession(db);
      await audit(db, "Tapas123", "admin.login.success", "admin", {});
      return safeJson(200, { ok: true, token }, request);
    }

    // POST /api/admin/logout
    if (path === "/logout" && request.method === "POST") {
      const token = adminToken(request);
      if (token) await db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/vip/analytics — VIP members, pending payments, weekly revenue.
    if (path === "/vip/analytics" && request.method === "GET") {
      const total = await db.prepare("SELECT COUNT(*) AS n FROM vip_members").first<{ n: number }>();
      const vip = await db.prepare("SELECT COUNT(*) AS n FROM vip_members WHERE status = 'vip'").first<{ n: number }>();
      const pendingMembers = await db.prepare("SELECT COUNT(*) AS n FROM vip_members WHERE status != 'vip'").first<{ n: number }>();
      const pendingPays = await db.prepare("SELECT COUNT(*) AS n FROM vip_payments WHERE status = 'pending'").first<{ n: number }>();
      const approvedPays = await db.prepare("SELECT COUNT(*) AS n FROM vip_payments WHERE status = 'approved'").first<{ n: number }>();
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const weekApproved = await db.prepare("SELECT COUNT(*) AS n FROM vip_payments WHERE status = 'approved' AND created_at >= ?").bind(weekAgo).first<{ n: number }>();
      return safeJson(200, {
        totalMembers: Number(total?.n ?? 0),
        vipMembers: Number(vip?.n ?? 0),
        pendingMembers: Number(pendingMembers?.n ?? 0),
        pendingPayments: Number(pendingPays?.n ?? 0),
        totalApprovedPayments: Number(approvedPays?.n ?? 0),
        approvedThisWeek: Number(weekApproved?.n ?? 0),
        revenueRs: Number(approvedPays?.n ?? 0) * 20,
        fetchedAt: new Date().toISOString(),
      }, request);
    }

    // Gateway announcements shown on the gateway page (VIP-only or all visitors).
    if (path === "/announcements" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { title?: unknown; bodyText?: unknown; body?: unknown; audience?: unknown; startsAt?: unknown; endsAt?: unknown };
      const title = String((b.title ?? "")).trim().slice(0, 120);
      if (!title) return safeJson(400, { ok: false, error: "Title is required" }, request);
      const bodyText = String((b.bodyText ?? b.body ?? "")).trim().slice(0, 2000);
      const audience = b.audience === "vip" ? "vip" : "all";
      const startsAt = typeof b.startsAt === "string" && b.startsAt ? b.startsAt : new Date().toISOString();
      const endsAt = typeof b.endsAt === "string" && b.endsAt ? b.endsAt : null;
      await db
        .prepare("INSERT INTO gateway_announcements (title, body, audience, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(title, bodyText, audience, startsAt, endsAt, new Date().toISOString())
        .run();
      await audit(db, "Tapas123", "announcement.create", "gateway_announcements", { title, audience }, "info").catch(() => {});
      return safeJson(200, { ok: true, title, audience, startsAt, endsAt }, request);
    }
    if (path === "/announcements" && request.method === "GET") {
      const rows = await db.prepare("SELECT id, title, body, audience, starts_at, ends_at, created_at FROM gateway_announcements ORDER BY id DESC LIMIT 50").all();
      return safeJson(200, { announcements: rows.results, fetchedAt: new Date().toISOString() }, request);
    }
    if (/^\/announcements\/\d+$/.test(path) && request.method === "DELETE") {
      const id = Number(path.split("/").pop());
      const row = await db.prepare("SELECT id, title FROM gateway_announcements WHERE id = ?").bind(id).first<{ id: number; title: string }>();
      if (!row) return safeJson(404, { ok: false, error: "Announcement not found" }, request);
      await db.prepare("DELETE FROM gateway_announcements WHERE id = ?").bind(id).run();
      await audit(db, "Tapas123", "announcement.delete", "gateway_announcements", { id, title: row.title }, "info").catch(() => {});
      return safeJson(200, { ok: true, deleted: id }, request);
    }

    // VIP Hub guide cards — per-tool "How to Use" steps (admin seeds/edits).
    if (path === "/guides" && request.method === "GET") {
      const rows = await db.prepare("SELECT tool_id, title, steps_json, tips_json, created_at FROM vip_guide_cards ORDER BY tool_id").all();
      return safeJson(200, { guides: rows.results, fetchedAt: new Date().toISOString() }, request);
    }
    if (path === "/guides" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { tool_id?: unknown; title?: unknown; steps?: unknown; tips?: unknown };
      const toolId = String((b.tool_id ?? "")).trim();
      const title = String((b.title ?? "")).trim().slice(0, 120);
      if (!toolId || !title) return safeJson(400, { ok: false, error: "tool_id and title are required" }, request);
      await db
        .prepare(
          "INSERT INTO vip_guide_cards (tool_id, title, steps_json, tips_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tool_id) DO UPDATE SET title=excluded.title, steps_json=excluded.steps_json, tips_json=excluded.tips_json",
        )
        .bind(toolId, title, JSON.stringify(b.steps ?? []), JSON.stringify(b.tips ?? []), new Date().toISOString())
        .run();
      return safeJson(200, { ok: true, toolId, title }, request);
    }

    // Tool ordering in VIP Hub — set display positions.
    if (path === "/tool-order" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { order?: Array<{ tool_id?: string; position?: number } | string> } | null;
      const order: Array<{ tool_id?: string; position?: number } | string> = Array.isArray(body?.order) ? (body!.order as Array<{ tool_id?: string; position?: number } | string>) : [];
      const stmts: D1PreparedStatement[] = [];
      for (const item of order) {
        const toolId = typeof item === "string" ? item : (item as { tool_id?: string })?.tool_id;
        const pos = typeof item === "number" ? item : Number(((item as { position?: number })?.position ?? 99));
        if (typeof toolId !== "string" || !toolId) continue;
        stmts.push(
          db
            .prepare("INSERT INTO tool_ordering (tool_id, position, updated_at) VALUES (?, ?, ?) ON CONFLICT(tool_id) DO UPDATE SET position=excluded.position, updated_at=excluded.updated_at")
            .bind(toolId, Number.isFinite(pos) ? pos : 99, new Date().toISOString()),
        );
      }
      if (stmts.length > 0) await db.batch(stmts);
      await audit(db, "Tapas123", "tool_order.update", "tool_ordering", { updated: stmts.length }, "info").catch(() => {});
      return safeJson(200, { ok: true, updated: stmts.length }, request);
    }

    // GET /api/admin/overview
    if (path === "/overview" && request.method === "GET") {
      const targets = await db.prepare("SELECT * FROM monitor_targets WHERE enabled = 1").all<{ id: number }>();
      const list = (targets.results ?? []) as { id: number }[];
      const latest = await db
        .prepare(
          `SELECT target_id, status FROM monitor_results r
           WHERE r.id = (SELECT MAX(m.id) FROM monitor_results m WHERE m.target_id = r.target_id)`,
        )
        .all<{ target_id: number; status: string }>();
      const latestRows = (latest.results ?? []) as { target_id: number; status: string }[];
      const latestByTarget = new Map(latestRows.map((r) => [r.target_id, r.status]));
      const counts = { green: 0, yellow: 0, red: 0 };
      for (const t of list) {
        const s = latestByTarget.get(t.id) ?? "yellow";
        if (s === "green") counts.green += 1;
        else if (s === "yellow") counts.yellow += 1;
        else counts.red += 1;
      }
      const openInc = await db.prepare("SELECT id FROM incidents WHERE status = 'open'").all<{ id: number }>();
      const total = await db
        .prepare("SELECT COUNT(*) AS c FROM monitor_results")
        .first<{ c: number }>();
      const ok200 = await db
        .prepare("SELECT COUNT(*) AS c FROM monitor_results WHERE status = 'green'")
        .first<{ c: number }>();
      const totalChecks = Number((total && (total as { c: unknown }).c) ?? 0);
      const greenChecks = Number((ok200 && (ok200 as { c: unknown }).c) ?? 0);
      return safeJson(200, {
        total: list.length,
        ...counts,
        openIncidents: (openInc.results ?? []).length,
        averageUptime: totalChecks > 0 ? Math.round((greenChecks / totalChecks) * 10000) / 100 : 100,
      }, request);
    }

    // GET /api/admin/monitors
    if (path === "/monitors" && request.method === "GET") {
      const targets = await db.prepare("SELECT * FROM monitor_targets ORDER BY id").all();
      const latest = await db
        .prepare(
          `SELECT target_id, status, latency_ms, status_code, error, checked_at FROM monitor_results r
           WHERE r.id = (SELECT MAX(m.id) FROM monitor_results m WHERE m.target_id = r.target_id)
           ORDER BY target_id`,
        )
        .all();
      const latestMap = new Map(
        ((latest.results ?? []) as { target_id: number }[]).map((r) => [r.target_id, r]),
      );
      const merged = ((targets.results ?? []) as Record<string, unknown>[]).map((t) => ({
        ...t,
        latest: (latestMap.get(Number(t.id)) ?? null) as Record<string, unknown> | null,
      }));
      return safeJson(200, merged, request);
    }

    // POST /api/admin/monitors/check
    if (path === "/monitors/check" && request.method === "POST") {
      await runAllChecks(db);
      await audit(db, "Tapas123", "monitor.check.run", "monitor", {});
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/incidents
    if (path === "/incidents" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM incidents ORDER BY id DESC LIMIT 50").all();
      return safeJson(200, rows.results ?? [], request);
    }

    // POST /api/admin/incidents
    if (path === "/incidents" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { title?: unknown; severity?: unknown; action?: unknown; id?: unknown; note?: unknown };
      if (b.action === "resolve" && b.id && b.note) {
        await db
          .prepare(
            "UPDATE incidents SET status = 'resolved', resolved_at = ?, note = ? WHERE id = ? AND status = 'open'",
          )
          .bind(new Date().toISOString(), String(b.note), Number(b.id))
          .run();
        await audit(db, "Tapas123", "incident.resolved", "incident", { id: b.id });
        return safeJson(200, { ok: true }, request);
      }
      if (b.action === "create" && b.title) {
        await db
          .prepare("INSERT INTO incidents (title, severity, status, created_at) VALUES (?, ?, 'open', ?)")
          .bind(String(b.title), String(b.severity ?? "warning"), new Date().toISOString())
          .run();
        await audit(db, "Tapas123", "incident.created", "incident", { title: b.title });
        return safeJson(200, { ok: true }, request);
      }
      return safeJson(400, { ok: false, error: "Invalid incident action" }, request);
    }

    // GET /api/admin/maintenance
    if (path === "/maintenance" && request.method === "GET") {
      return safeJson(200, await readMaintenance(db), request);
    }

    // POST /api/admin/maintenance/toggle
    if (path === "/maintenance/toggle" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { enabled?: unknown; message?: unknown; scope?: unknown; scheduledEnd?: unknown; mode?: unknown };
      const scope: MaintenanceScope =
        b.scope === "bio" || b.scope === "vip" ? (b.scope as MaintenanceScope) : "both";
      const mode: MaintenanceMode = String(b.mode) === "update" ? "update" : "maintenance";
      let scheduledEnd: string | null = null;
      // The frontend sends a datetime-local value (e.g. "2026-08-20T01:06") which has
      // no timezone. The admin operator is in India (IST, UTC+5:30), and the Worker
      // runtime is UTC, so parse it explicitly as IST wall-clock time by appending
      // the +05:30 offset before constructing the Date.
      let end = new Date(String(b.scheduledEnd ?? ""));
      if (b.enabled) {
        const raw = String(b.scheduledEnd ?? "");
        const m = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/);
        if (m) {
          end = new Date(`${m[1]}:00+05:30`);
        } else {
          end = new Date(raw);
        }
        if (Number.isFinite(end.valueOf()) && end.getTime() > Date.now()) {
          scheduledEnd = end.toISOString();
        }
      }
      const state: MaintenanceState = { enabled: Boolean(b.enabled), message: String(b.message ?? ""), scope, mode, scheduledEnd };
      await writeConfig(db, "maintenance_mode", state);
      await audit(db, "Tapas123", "maintenance.toggle", "maintenance", state, state.enabled ? "warning" : "info");
      const scopeLabel = state.scope === "bio" ? "Bio Tool" : state.scope === "vip" ? "VIP Hub" : "the whole site";
      const endNote = scheduledEnd ? ` and auto-reopens at ${scheduledEnd.slice(0, 16).replace("T", " ")}` : "";
      const modeLabel = mode === "update" ? "Update" : "Maintenance";
      await notify(
        db,
        state.enabled
          ? `${modeLabel} mode is ON for ${scopeLabel}${endNote} — visitors see the ${modeLabel.toLowerCase()} screen there.`
          : "Maintenance mode is OFF — site is live.",
        state.enabled ? "warning" : "info",
      );
      return safeJson(200, { ok: true, ...state }, request);
    }

    // GET /api/admin/banner
    if (path === "/banner" && request.method === "POST") {
      return safeJson(405, { ok: false, error: "Use GET for banner" }, request);
    }

    // POST /api/admin/banner/set
    if (path === "/banner/set" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { text?: unknown; ttlHours?: unknown; startsAt?: unknown };
      const text = String(b.text ?? "").trim();
      if (!text) return safeJson(400, { ok: false, error: "Banner text is empty" }, request);
      let expiresAt: string | null = null;
      const ttlHours = Number(b.ttlHours);
      if (Number.isFinite(ttlHours) && ttlHours > 0) {
        expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
      }
      // Scheduled start, same IST rule as maintenance scheduling (operator in India, worker in UTC).
      let startsAt: string | null = null;
      const rawStart = String(b.startsAt ?? "").trim();
      if (rawStart) {
        const m = rawStart.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/);
        let start = new Date(m ? `${m[1]}:00+05:30` : rawStart);
        if (Number.isFinite(start.valueOf()) && start.getTime() > Date.now()) {
          startsAt = start.toISOString();
        }
      }
      const banner: BannerState = { text, expiresAt, startsAt };
      await writeConfig(db, "active_banner", banner);
      await audit(db, "Tapas123", "banner.set", "banner", { text, ttlHours: expiresAt ? ttlHours : null, startsAt });
      await notify(db, `New banner pushed: ${text.slice(0, 80)}`, "info");
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/banner/clear
    if (path === "/banner/clear" && request.method === "POST") {
      await db.prepare("DELETE FROM site_config WHERE key = 'active_banner'").run();
      await audit(db, "Tapas123", "banner.cleared", "banner", {});
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/banner/announce — convenience: announcement text pushed as banner immediately
    if (path === "/banner/announce" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { text?: unknown; ttlHours?: unknown };
      const text = String(b.text ?? "").trim();
      if (!text) return safeJson(400, { ok: false, error: "Announcement text is empty" }, request);
      const ttlHours = Number.isFinite(Number(b.ttlHours)) && Number(b.ttlHours) > 0 ? Number(b.ttlHours) : 72;
      await writeConfig(db, "active_banner", {
        text,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
        startsAt: null,
      } as BannerState);
      await audit(db, "Tapas123", "banner.announce", "banner", { text, ttlHours });
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/notifications
    if (path === "/notifications" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 60").all();
      return safeJson(200, rows.results ?? [], request);
    }

    // POST /api/admin/notifications/read
    if (path === "/notifications/read" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { id?: unknown; markAll?: unknown };
      if (b.markAll) {
        await db.prepare("UPDATE notifications SET is_read = 1").run();
        return safeJson(200, { ok: true }, request);
      }
      if (b.id) await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(Number(b.id)).run();
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/audit
    if (path === "/audit" && request.method === "GET") {
      const url = new URL(request.url);
      const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
      const from = String(url.searchParams.get("from") ?? "");
      const to = String(url.searchParams.get("to") ?? "");
      let sql = "SELECT * FROM audit_log";
      const where: string[] = [];
      const params: (string | number)[] = [];
      if (search) {
        where.push("(action LIKE ? OR actor LIKE ? OR entity LIKE ? OR metadata_json LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (from) {
        where.push("created_at >= ?");
        params.push(from);
      }
      if (to) {
        where.push("created_at <= ?");
        params.push(`${to}T23:59:59`);
      }
      if (where.length > 0) sql += ` WHERE ${where.join(" AND ")}`;
      sql += " ORDER BY id DESC LIMIT 200";
      const rows = await db.prepare(sql).bind(...params).all();
      return safeJson(200, rows.results ?? [], request);
    }

    // POST /api/admin/announcements — create a manual announcement (Activity feed)
    if (path === "/announcements" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { title?: unknown; body?: unknown; severity?: unknown; ttlHours?: unknown };
      const title = String(b.title ?? "").trim();
      if (!title) return safeJson(400, { ok: false, error: "Announcement title is empty" }, request);
      let expiresAt: string | null = null;
      const ttlHours = Number(b.ttlHours);
      if (Number.isFinite(ttlHours) && ttlHours > 0) {
        expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
      }
      await db
        .prepare("INSERT INTO announcements (title, body, severity, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
        .bind(title, String(b.body ?? ""), String(b.severity ?? "info"), new Date().toISOString(), expiresAt)
        .run();
      await audit(db, "Tapas123", "announcement.created", "announcement", { title });
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/announcements
    if (path === "/announcements" && request.method === "GET") {
      const rows = await db
        .prepare("SELECT * FROM announcements ORDER BY pinned DESC, id DESC LIMIT 100")
        .all();
      return safeJson(200, rows.results ?? [], request);
    }

    // POST /api/admin/announcements/remove
    if (path === "/announcements/remove" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { id?: unknown };
      if (b.id) {
        await db.prepare("DELETE FROM announcements WHERE id = ?").bind(Number(b.id)).run();
        await audit(db, "Tapas123", "announcement.removed", "announcement", { id: b.id });
      }
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/lock — emergency full-site lock (one-tap)
    if (path === "/lock" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { locked?: unknown };
      const locked = Boolean(b.locked);
      const state: MaintenanceState = locked
        ? { enabled: true, message: "Site locked by admin — full maintenance in progress.", scope: "both", mode: "maintenance", scheduledEnd: null }
        : { enabled: false, message: "", scope: "both", mode: "maintenance", scheduledEnd: null };
      await writeConfig(db, "maintenance_mode", state);
      await audit(db, "Tapas123", "emergency.lock", "maintenance", { locked }, locked ? "warning" : "info");
      return safeJson(200, { ok: true, locked }, request);
    }

    // GET /api/admin/requests — visitor tool requests
    if (path === "/requests" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM tool_requests ORDER BY id DESC LIMIT 100").all();
      return safeJson(200, rows.results ?? [], request);
    }

    // POST /api/admin/requests/mark
    if (path === "/requests/mark" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { id?: unknown; action?: unknown };
      if (b.id) {
        const status = b.action === "done" ? "done" : "open";
        await db.prepare("UPDATE tool_requests SET status = ? WHERE id = ?").bind(status, Number(b.id)).run();
        await audit(db, "Tapas123", "request.marked", "request", { id: b.id, status });
      }
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/stats — real anonymous visitor stats + tool requests count
    if (path === "/stats" && request.method === "GET") {
      const day = new Date().toISOString().slice(0, 10);
      const todayDevices = await db
        .prepare("SELECT COUNT(*) AS c FROM visit_counters WHERE day = ?")
        .bind(day)
        .first<{ c: number }>();
      const todayRequests = await db
        .prepare("SELECT SUM(requests) AS c FROM visit_counters WHERE day = ?")
        .bind(day)
        .first<{ c: number }>();
      const totalDevices = await db.prepare("SELECT COUNT(*) AS c FROM visit_counters").first<{ c: number }>();
      const topPaths = await db
        .prepare(
          "SELECT path, SUM(requests) AS visits FROM visit_counters GROUP BY path ORDER BY visits DESC LIMIT 8",
        )
        .all<{ path: string; visits: number }>();
      const openRequests = await db.prepare("SELECT COUNT(*) AS c FROM tool_requests WHERE status = 'open'").first<{ c: number }>();
      return safeJson(200, {
        today: {
          devices: Number((todayDevices && (todayDevices as { c: unknown }).c) ?? 0),
          pageViews: Number((todayRequests && (todayRequests as { c: unknown }).c) ?? 0),
        },
        totalDevices: Number((totalDevices && (totalDevices as { c: unknown }).c) ?? 0),
        topPaths: (topPaths.results ?? []) as { path: string; visits: number }[],
        openToolRequests: Number((openRequests && (openRequests as { c: unknown }).c) ?? 0),
      }, request);
    }

    // POST /api/admin/ordering — set display position per tool
    if (path === "/ordering" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const b = (body ?? {}) as { toolId?: unknown; position?: unknown; reset?: unknown };
      if (b.reset) {
        await db.prepare("DELETE FROM tool_ordering").run();
        return safeJson(200, { ok: true }, request);
      }
      if (b.toolId) {
        await db
          .prepare("INSERT OR REPLACE INTO tool_ordering (tool_id, position, updated_at) VALUES (?, ?, ?)")
          .bind(String(b.toolId), Number(b.position ?? 99), new Date().toISOString())
          .run();
        await audit(db, "Tapas123", "tool.ordering.updated", "tool", { toolId: b.toolId, position: b.position });
      }
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/ordering
    if (path === "/ordering" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM tool_ordering ORDER BY position ASC").all();
      return safeJson(200, rows.results ?? [], request);
    }

    // GET /api/admin/summary (on-demand daily/weekly-style summary, like repo reports)
    if (path === "/summary" && request.method === "GET") {
      recordVisit(db, "/api/admin/summary", deviceFingerprint(request));
      const last24h = await db
        .prepare("SELECT COUNT(*) AS c FROM monitor_results WHERE checked_at > datetime('now', '-1 day')")
        .first<{ c: number }>();
      const last24hRed = await db
        .prepare(
          "SELECT COUNT(*) AS c FROM monitor_results WHERE checked_at > datetime('now', '-1 day') AND status = 'red'",
        )
        .first<{ c: number }>();
      const incidentsToday = await db
        .prepare("SELECT COUNT(*) AS c FROM incidents WHERE created_at > datetime('now', '-1 day')")
        .first<{ c: number }>();
      const auditsToday = await db
        .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE created_at > datetime('now', '-1 day')")
        .first<{ c: number }>();
      return safeJson(200, {
        checksLast24h: Number((last24h && (last24h as { c: unknown }).c) ?? 0),
        failuresLast24h: Number((last24hRed && (last24hRed as { c: unknown }).c) ?? 0),
        incidentsLast24h: Number((incidentsToday && (incidentsToday as { c: unknown }).c) ?? 0),
        adminActionsLast24h: Number((auditsToday && (auditsToday as { c: unknown }).c) ?? 0),
      }, request);
    }

    // GET /api/admin/vip — lifetime VIP members + pending payments
    if (path === "/vip" && request.method === "GET") {
      recordVisit(db, "/api/admin/vip", deviceFingerprint(request));
      const members = await db.prepare("SELECT * FROM vip_members ORDER BY created_at DESC LIMIT 200").all();
      const payments = await db.prepare("SELECT * FROM vip_payments ORDER BY id DESC LIMIT 200").all();
      const blocks = await db.prepare("SELECT * FROM vip_blocks ORDER BY created_at DESC LIMIT 200").all();
      return safeJson(200, { members: members.results ?? [], payments: payments.results ?? [], blocks: blocks.results ?? [] }, request);
    }

    // POST /api/admin/vip/approve — approve a payment, lifetime access for the member key
    if (path === "/vip/approve" && request.method === "POST") {
      recordVisit(db, "/api/admin/vip/approve", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { paymentId?: unknown; memberKey?: string; approve?: boolean };
      const paymentId = Number(parsed.paymentId);
      if (!Number.isFinite(paymentId) || !parsed.memberKey || typeof parsed.memberKey !== "string") {
        return safeJson(400, { ok: false, error: "Missing payment id or member key" }, request);
      }
      const payment = await db.prepare("SELECT * FROM vip_payments WHERE id = ?").bind(paymentId).first<{ id: number; member_key: string; status: string; created_at: string }>();
      if (!payment || payment.member_key !== parsed.memberKey) {
        return safeJson(404, { ok: false, error: "Payment not found or key mismatch" }, request);
      }
      const approve = parsed.approve !== false;
      if (approve && payment.status !== "approved") {
        await db.prepare("UPDATE vip_payments SET status = 'approved' WHERE id = ?").bind(paymentId).run();
        await db
          .prepare("UPDATE vip_members SET status = 'vip', paid_at = COALESCE(paid_at, ?), approved_at = ? WHERE member_key = ?")
          .bind(payment.created_at, new Date().toISOString(), payment.member_key)
          .run();
      }
      if (!approve && payment.status !== "rejected") {
        await db.prepare("UPDATE vip_payments SET status = 'rejected' WHERE id = ?").bind(paymentId).run();
      }
      await audit(db, "Tapas123", approve ? "vip.approve" : "vip.reject", payment.member_key, { paymentId, memberKey: payment.member_key }).catch(() => {});
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/vip/config — current UPI payment config
    if (path === "/vip/config" && request.method === "GET") {
      recordVisit(db, "/api/admin/vip/config", deviceFingerprint(request));
      const cfg = await db.prepare("SELECT value FROM site_config WHERE key = 'vip_payment_config'").first<{ value: string }>();
      let config: object | null = null; try { if (cfg) { config = JSON.parse(cfg.value); } } catch { config = null; }
      return safeJson(200, config ?? { upiId: "", upiName: "", amount: 20, qrDataUrl: "" }, request);
    }

    // POST /api/admin/vip/config — store UPI id / amount
    if (path === "/vip/config" && request.method === "POST") {
      recordVisit(db, "/api/admin/vip/config", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { upiId?: unknown; upiName?: unknown; amount?: unknown; qrDataUrl?: unknown };
      const upiId = typeof parsed.upiId === "string" ? parsed.upiId.trim() : "";
      const upiName = typeof parsed.upiName === "string" ? parsed.upiName.trim() : "RNS BIGBULL";
      const amount = Math.min(10000, Math.max(1, Number(parsed.amount) || 20));
      const qrDataUrl = typeof parsed.qrDataUrl === "string" ? parsed.qrDataUrl : "";
      await db
        .prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('vip_payment_config', ?, ?)")
        .bind(JSON.stringify({ upiId, upiName, amount, qrDataUrl }), new Date().toISOString())
        .run();
      await audit(db, "Tapas123", "vip.config.update", "site_config", { upiId, amount }).catch(() => {});
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/vip/generate — admin manually creates a lifetime VIP key for a user
    if (path === "/vip/generate" && request.method === "POST") {
      recordVisit(db, "/api/admin/vip/generate", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { displayName?: unknown; email?: unknown };
      const displayName = typeof parsed.displayName === "string" ? parsed.displayName.trim().slice(0, 60) : "";
      if (!displayName) return safeJson(400, { ok: false, error: "Display name is required" }, request);
      const email = typeof parsed.email === "string" ? parsed.email.trim().slice(0, 120) : "";
      // Try to reuse a key if one was already generated/registered for this exact name (idempotent lookup).
      let row = await db.prepare("SELECT member_key FROM vip_members WHERE display_name = ? ORDER BY created_at DESC LIMIT 1").bind(displayName).first<{ member_key: string }>();
      let memberKey = row?.member_key ?? "";
      if (!memberKey) {
        memberKey = generateMemberKey();
        await db
          .prepare("INSERT INTO vip_members (member_key, display_name, email, status, paid_at, approved_at, created_at) VALUES (?, ?, ?, 'vip', ?, ?, ?)")
          .bind(memberKey, displayName, email || null, new Date().toISOString(), new Date().toISOString(), new Date().toISOString())
          .run();
      } else {
        await db.prepare("UPDATE vip_members SET status = 'vip', paid_at = COALESCE(paid_at, ?), approved_at = ? WHERE member_key = ?").bind(new Date().toISOString(), new Date().toISOString(), memberKey).run();
      }
      await audit(db, "Tapas123", "vip.generate", memberKey, { displayName, email }).catch(() => {});
      return safeJson(200, { ok: true, memberKey }, request);
    }

    // POST /api/admin/vip/block — block a member: VIP access revoked until re-pay
    if (path === "/vip/block" && request.method === "POST") {
      recordVisit(db, "/api/admin/vip/block", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { memberKey?: unknown; reason?: unknown };
      const memberKey = typeof parsed.memberKey === "string" ? parsed.memberKey.trim() : "";
      if (!memberKey) return safeJson(400, { ok: false, error: "Member key is required" }, request);
      const reason = typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 200) : "Blocked by admin";
      const exists = await db.prepare("SELECT member_key FROM vip_members WHERE member_key = ?").bind(memberKey).first<{ member_key: string }>();
      if (!exists) return safeJson(404, { ok: false, error: "Member not found" }, request);
      const now = new Date().toISOString();
      await db
        .prepare("INSERT OR REPLACE INTO vip_blocks (member_key, reason, blocked_at, created_at) VALUES (?, ?, ?, ?)")
        .bind(memberKey, reason, now, now)
        .run();
      await db
        .prepare("UPDATE vip_members SET status = 'registered' WHERE member_key = ?")
        .bind(memberKey)
        .run();
      await audit(db, "Tapas123", "vip.block", memberKey, { reason }).catch(() => {});
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/vip/unblock — lift the block, member can access again
    if (path === "/vip/unblock" && request.method === "POST") {
      recordVisit(db, "/api/admin/vip/unblock", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { memberKey?: unknown };
      const memberKey = typeof parsed.memberKey === "string" ? parsed.memberKey.trim() : "";
      if (!memberKey) return safeJson(400, { ok: false, error: "Member key is required" }, request);
      await db.prepare("DELETE FROM vip_blocks WHERE member_key = ?").bind(memberKey).run();
      await audit(db, "Tapas123", "vip.unblock", memberKey, {}).catch(() => {});
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/uid-seed — list manually seeded UID profiles
    if (path === "/uid-seed" && request.method === "GET") {
      recordVisit(db, "/api/admin/uid-seed", deviceFingerprint(request));
      const seeds = await db.prepare("SELECT * FROM uid_seed ORDER BY created_at DESC LIMIT 200").all();
      return safeJson(200, { seeds: seeds.results ?? [] }, request);
    }

    // POST /api/admin/uid-seed — add or update a seeded UID profile
    if (path === "/uid-seed" && request.method === "POST") {
      recordVisit(db, "/api/admin/uid-seed", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { uid?: unknown; name?: unknown; region?: unknown };
      const uid = typeof parsed.uid === "string" ? parsed.uid.trim().slice(0, 16) : "";
      const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 60) : "";
      const region = typeof parsed.region === "string" ? parsed.region.trim().slice(0, 10).toUpperCase() : "IND";
      if (!uid || !name) return safeJson(400, { ok: false, error: "UID and name are required" }, request);
      await db
        .prepare("INSERT OR REPLACE INTO uid_seed (uid, name, region, created_at) VALUES (?, ?, ?, ?)")
        .bind(uid, name, region, new Date().toISOString())
        .run();
      await audit(db, "Tapas123", "uid.seed", uid, { name, region }).catch(() => {});
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/uid-seed/delete — remove a seeded UID
    if (path === "/uid-seed/delete" && request.method === "POST") {
      recordVisit(db, "/api/admin/uid-seed/delete", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { uid?: unknown };
      const uid = typeof parsed.uid === "string" ? parsed.uid.trim() : "";
      if (!uid) return safeJson(400, { ok: false, error: "UID is required" }, request);
      await db.prepare("DELETE FROM uid_seed WHERE uid = ?").bind(uid).run();
      await db.prepare("DELETE FROM ff_uid_cache WHERE uid = ?").bind(uid).run();
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/music — current gateway music URL
    if (path === "/music" && request.method === "GET") {
      recordVisit(db, "/api/admin/music", deviceFingerprint(request));
      const row = await db.prepare("SELECT value FROM site_config WHERE key = 'gateway_music_url'").first<{ value: string }>();
      return safeJson(200, { url: row?.value ?? null }, request);
    }
    // POST /api/admin/music — set the gateway auto-play music URL (mp3/m3u8 or any audio url; empty string clears)
    if (path === "/music" && request.method === "POST") {
      recordVisit(db, "/api/admin/music", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { url?: unknown };
      const url = typeof parsed.url === "string" ? parsed.url.trim().slice(0, 500) : "";
      if (!/^https?:\/\//i.test(url) && url !== "") {
        return safeJson(400, { ok: false, error: "URL must start with http:// or https://" }, request);
      }
      if (url === "") {
        await db.prepare("DELETE FROM site_config WHERE key = 'gateway_music_url'").run();
      } else {
        await db
          .prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('gateway_music_url', ?, ?)")
          .bind(url, new Date().toISOString())
          .run();
      }
      await audit(db, "Tapas123", "gateway.music.update", "site_config", { url: url || "(cleared)" }).catch(() => {});
      return safeJson(200, { ok: true, url: url || null }, request);
    }
    // POST /api/admin/upload-music — receive an audio file from the browser and store it directly
    // in the site database (hosted file servers block uploads from Cloudflare IPs, so we self-host).
    // The public GET /api/music then streams the stored file to every visitor.
    if (path === "/upload-music" && request.method === "POST") {
      recordVisit(db, "/api/admin/upload-music", deviceFingerprint(request));
      try {
        const ct = request.headers.get("content-type") ?? "";
        if (!ct.includes("multipart/form-data")) {
          return safeJson(400, { ok: false, error: "Send the file as multipart/form-data with field name 'fileToUpload'" }, request);
        }
        const form = await request.formData();
        const part = form.get("fileToUpload");
        if (!part || typeof part === "string") {
          return safeJson(400, { ok: false, error: "No file received — pick an MP3 from your files." }, request);
        }
        const file = part as File;
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > 10 * 1024 * 1024) {
          return safeJson(400, { ok: false, error: "File is larger than 10 MB — pick a smaller MP3." }, request);
        }
        if (bytes.byteLength > 3 * 1024 * 1024) {
          return safeJson(400, { ok: false, error: "File is larger than 3 MB — the site hosts music on its own server (limit 3 MB). Compress the MP3 (e.g. 64–128 kbps) or trim it shorter." }, request);
        }
        const base64 = uint8ToBase64(new Uint8Array(bytes));
        await db
          .prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('gateway_music_blob', ?, ?)")
          .bind(base64, new Date().toISOString())
          .run();
        await audit(db, "Tapas123", "gateway.music.upload", "site_config", { name: file.name, bytes: bytes.byteLength }).catch(() => {});
        return safeJson(200, { ok: true, blob: true }, request);
      } catch {
        return safeJson(500, { ok: false, error: "Upload failed — check your connection and retry." }, request);
      }
    }
    // GET /api/admin/ff-api-key — FreeFireApi key used by the UID deep lookup (returns masked)
    if (path === "/ff-api-key" && request.method === "GET") {
      recordVisit(db, "/api/admin/ff-api-key", deviceFingerprint(request));
      const row = await db.prepare("SELECT value FROM site_config WHERE key = 'ff_api_key'").first<{ value: string }>();
      const v = row?.value ?? "";
      return safeJson(200, { ok: true, key: v, masked: v ? `${v.slice(0, 4)}••••${v.slice(-3)}` : null }, request);
    }
    // POST /api/admin/ff-api-key — set the FreeFireApi key (siambhau69.eu.cc) for full UID profiles; empty clears
    if (path === "/ff-api-key" && request.method === "POST") {
      recordVisit(db, "/api/admin/ff-api-key", deviceFingerprint(request));
      const parsed = (await request.json().catch(() => ({}))) as { key?: unknown };
      const key = typeof parsed.key === "string" ? parsed.key.trim().slice(0, 80) : "";
      if (key === "") {
        await db.prepare("DELETE FROM site_config WHERE key = 'ff_api_key'").run();
      } else {
        await db.prepare("INSERT OR REPLACE INTO site_config (key, value, updated_at) VALUES ('ff_api_key', ?, ?)").bind(key, new Date().toISOString()).run();
      }
      await audit(db, "Tapas123", "ff.apikey.update", "site_config", { set: key !== "" }).catch(() => {});
      return safeJson(200, { ok: true, set: key !== "" }, request);
    }
    return safeJson(404, { ok: false, error: "Route not found" }, request);
  } catch (error) {
    const message = (error as { message?: string }).message ?? "Internal error";
    console.error("Admin error", message);
    return safeJson(502, { ok: false, error: message }, request);
  }
}

// ---------------------------------------------------------------------------
// Public banner endpoint (no auth)
// ---------------------------------------------------------------------------

export async function handleBanner(db: D1Database, request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.has("visit")) {
    // Anonymous page-visit counter used by the visitor-stats panel.
    const ua = request.headers.get("User-Agent") ?? "unknown";
    const device = /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
    const day = new Date().toISOString().slice(0, 10);
    await db
      .prepare(
        "INSERT INTO visit_counters (day, path, device, requests) VALUES (?, 'site', ?, 1) ON CONFLICT(day, path, device) DO UPDATE SET requests = requests + 1",
      )
      .bind(day, device)
      .run();
  }
  try {
    const banner = await readBanner(db);
    const maintenance = await readMaintenance(db);
    const resp = new Response(JSON.stringify({ banner, maintenance }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const origin = request.headers.get("Origin") ?? "";
    const allowed = ["https://rnsbigbull.site", "https://www.rnsbigbull.site", "https://rnsbigbull-site.pages.dev"];
    if (allowed.includes(origin)) {
      resp.headers.set("access-control-allow-origin", origin);
    }
    return resp;
  } catch {
    // Never break the public site: return an empty safe state.
    return new Response(JSON.stringify({ banner: null, maintenance: { enabled: false, message: "", scope: "both", scheduledEnd: null } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
