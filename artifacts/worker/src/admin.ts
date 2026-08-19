// RNS BIGBULL hidden admin console (backed by D1).
// Endpoints: POST/GET /api/admin/* — require x-admin-token header (session).
// Public mirror: GET /api/banner — returns active banner + maintenance state.

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
  void db
    .prepare("UPDATE admin_sessions SET expires_at = datetime('now', '+7 days') WHERE token = ?")
    .bind(token)
    .run();
  return true;
}

// ---------------------------------------------------------------------------
// Audit + notifications
// ---------------------------------------------------------------------------

async function audit(db: D1Database, actor: string, action: string, entity: string, metadata: unknown, severity = "info"): Promise<void> {
  void db
    .prepare("INSERT INTO audit_log (actor, action, entity, metadata_json, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(actor, action, entity, JSON.stringify(metadata ?? {}), severity, new Date().toISOString())
    .run();
}

async function notify(db: D1Database, text: string, severity = "info"): Promise<void> {
  void db
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
}

type MaintenanceScope = "both" | "bio" | "vip";

interface MaintenanceState {
  enabled: boolean;
  message: string;
  scope: MaintenanceScope;
}

async function readBanner(db: D1Database): Promise<BannerState | null> {
  const row = await db.prepare("SELECT value FROM site_config WHERE key = 'active_banner'").first<{ value: string }>();
  if (!row) return null;
  try {
    const parsed: BannerState = JSON.parse(row.value);
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readMaintenance(db: D1Database): Promise<MaintenanceState> {
  const row = await db.prepare("SELECT value FROM site_config WHERE key = 'maintenance_mode'").first<{ value: string }>();
  if (!row) return { enabled: false, message: "", scope: "both" };
  try {
    const parsed = JSON.parse(row.value) as Partial<MaintenanceState>;
    const scope: MaintenanceScope = parsed.scope === "bio" || parsed.scope === "vip" ? parsed.scope : "both";
    return { enabled: Boolean(parsed.enabled), message: String(parsed.message ?? ""), scope };
  } catch {
    return { enabled: false, message: "", scope: "both" };
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
    void db
      .prepare(
        "INSERT INTO monitor_results (target_id, status, latency_ms, status_code, error, checked_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(target.id, result.status, result.latency_ms, response.status, null, new Date().toISOString())
      .run();
    return result;
  } catch (error) {
    const message = (error as { message?: string }).message ?? "check failed";
    const result = { id: target.id, status: "red" as const, latency_ms: null as number | null, error: message };
    void db
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
      void db
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

export async function handleAdmin(db: D1Database, request: Request, path: string): Promise<Response> {
  await ensureSchema(db);

  const requiresAuth = path !== "/login" && path !== "/banner";
  if (requiresAuth && !(await resolveSession(db, adminToken(request)))) {
    return safeJson(401, { ok: false, error: "Not signed in" }, request);
  }
  if (request.method !== "GET" && request.method !== "POST") {
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
      if (token) void db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
      return safeJson(200, { ok: true }, request);
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
      const b = (body ?? {}) as { enabled?: unknown; message?: unknown; scope?: unknown };
      const scope: MaintenanceScope =
        b.scope === "bio" || b.scope === "vip" ? (b.scope as MaintenanceScope) : "both";
      const state: MaintenanceState = { enabled: Boolean(b.enabled), message: String(b.message ?? ""), scope };
      await writeConfig(db, "maintenance_mode", state);
      await audit(db, "Tapas123", "maintenance.toggle", "maintenance", state, state.enabled ? "warning" : "info");
      const scopeLabel = state.scope === "bio" ? "Bio Tool" : state.scope === "vip" ? "VIP Hub" : "the whole site";
      await notify(
        db,
        state.enabled
          ? `Maintenance mode is ON for ${scopeLabel} — visitors see the maintenance screen there.`
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
      const b = (body ?? {}) as { text?: unknown; ttlHours?: unknown };
      const text = String(b.text ?? "").trim();
      if (!text) return safeJson(400, { ok: false, error: "Banner text is empty" }, request);
      let expiresAt: string | null = null;
      const ttlHours = Number(b.ttlHours);
      if (Number.isFinite(ttlHours) && ttlHours > 0) {
        expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
      }
      await writeConfig(db, "active_banner", { text, expiresAt } as BannerState);
      await audit(db, "Tapas123", "banner.set", "banner", { text, ttlHours: expiresAt ? ttlHours : null });
      await notify(db, `New banner pushed: ${text.slice(0, 80)}`, "info");
      return safeJson(200, { ok: true }, request);
    }

    // POST /api/admin/banner/clear
    if (path === "/banner/clear" && request.method === "POST") {
      void db.prepare("DELETE FROM site_config WHERE key = 'active_banner'").run();
      await audit(db, "Tapas123", "banner.cleared", "banner", {});
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
        void db.prepare("UPDATE notifications SET is_read = 1").run();
        return safeJson(200, { ok: true }, request);
      }
      if (b.id) void db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(Number(b.id)).run();
      return safeJson(200, { ok: true }, request);
    }

    // GET /api/admin/audit
    if (path === "/audit" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 100").all();
      return safeJson(200, rows.results ?? [], request);
    }

    // GET /api/admin/summary (on-demand daily/weekly-style summary, like repo reports)
    if (path === "/summary" && request.method === "GET") {
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
    return new Response(JSON.stringify({ banner: null, maintenance: { enabled: false, message: "" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
