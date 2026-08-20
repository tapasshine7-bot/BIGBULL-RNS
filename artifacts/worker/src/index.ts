// RNS BIGBULL public portal Worker.
// Public endpoints are open (no payment system). Admin endpoints live under /api/admin.

import { handleAdmin, handleBanner } from "./admin";
import { handleFfTools, recordStatusHistory } from "./fftools";

export interface Env {
  db: D1Database;
}

interface ToolRow {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  is_free: number;
  enabled: number;
}

interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  status: string;
  category: string;
  isFree: boolean;
}

const ALLOWED_ORIGINS = ["https://rnsbigbull.site", "https://www.rnsbigbull.site", "https://rnsbigbull-site.pages.dev"];

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsResponse(response: Response, request: Request): Response {
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-credentials", "true");
    response.headers.set("vary", "Origin");
  }
  return response;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sanitizeInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, 500);
}

async function recordPublicVisit(db: D1Database, path: string, request: Request): Promise<void> {
  const ua = request.headers.get("User-Agent") ?? "unknown";
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  const device = isMobile ? "mobile" : "desktop";
  const day = new Date().toISOString().slice(0, 10);
  void db
    .prepare(
      "INSERT INTO visit_counters (day, path, device, requests) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, device) DO UPDATE SET requests = requests + 1",
    )
    .bind(day, path, device)
    .run();
}

function toolToPublic(tool: ToolRow): Tool {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    status: "online",
    category: tool.category,
    isFree: tool.is_free === 1,
  };
}

async function listTools(db: D1Database, freeOnly = false): Promise<ToolRow[]> {
  const base = freeOnly
    ? db.prepare("SELECT * FROM tool_registry WHERE enabled = 1 AND is_free = 1 ORDER BY id")
    : db.prepare("SELECT * FROM tool_registry WHERE enabled = 1 ORDER BY id");
  const { results } = await base.all<ToolRow>();
  return results ?? [];
}

async function loadOrdering(db: D1Database): Promise<Map<string, number>> {
  const rows = await db.prepare("SELECT tool_id, position FROM tool_ordering").all<{ tool_id: string; position: number }>();
  return new Map(((rows.results ?? []) as { tool_id: string; position: number }[]).map((r) => [r.tool_id, r.position]));
}

async function reorderTools(db: D1Database, tools: ToolRow[]): Promise<ToolRow[]> {
  const ordering = await loadOrdering(db);
  return [...tools].sort((a, b) => {
    const pa = ordering.get(a.id) ?? 99;
    const pb = ordering.get(b.id) ?? 99;
    return pa - pb || a.id.localeCompare(b.id);
  });
}

interface ToolStatus {
  id: string;
  status: "online" | "offline";
  latencyMs: number | null;
  checkedAt: string;
}

// Browser-like headers so bot-protection frontends (e.g. Cloudflare challenge
// pages) answer with a real 200 page instead of a 403 that looks like downtime.
const PROBE_HEADERS = new Headers({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
});

async function probeTool(tool: ToolRow): Promise<ToolStatus> {
  const checkedAt = new Date().toISOString();
  let lastStatus: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = Date.now();
    try {
      const response = await fetch(tool.url, { method: "HEAD", redirect: "manual", headers: PROBE_HEADERS, cf: { cacheTtl: 0 } });
      if (response.status >= 200 && response.status < 400) {
        // 2xx and 3xx (redirects) both mean the tool's own origin answered — online.
        return { id: tool.id, status: "online", latencyMs: Date.now() - start, checkedAt };
      }
      lastStatus = "offline";
      if (attempt === 0) await new Promise<void>((resolve) => setTimeout(() => resolve(), 900));
    } catch {
      lastStatus = "offline";
      if (attempt === 0) await new Promise<void>((resolve) => setTimeout(() => resolve(), 900));
    }
  }
  // Some bot-protection stacks block HEAD requests entirely (403). A GET with
  // browser headers often returns a real page — that means the origin is UP.
  try {
    const response = await fetch(tool.url, { method: "GET", redirect: "manual", headers: PROBE_HEADERS, cf: { cacheTtl: 0 } });
    const body = await response.text().catch(() => "");
    if (response.status < 400) {
      // Origin answered with a real page (even a login/portal page) — online.
      return { id: tool.id, status: "online", latencyMs: null, checkedAt };
    }
    if (response.status === 403 || response.status === 404) {
      // A 403 "Just a moment..." challenge page (or similar bot gate) means the
      // domain's server stack (DNS + edge + origin) is ALIVE — only the
      // datacenter probe IP is being challenged. Real visitors' phones pass the
      // challenge fine, so report ONLINE instead of a misleading OFFLINE pill.
      if (body.length >= 200) {
        return { id: tool.id, status: "online", latencyMs: null, checkedAt };
      }
    }
  } catch {
    /* keep offline */
  }
  return { id: tool.id, status: (lastStatus ?? "offline") as ToolStatus["status"], latencyMs: null, checkedAt };
}

async function probeAll(tools: ToolRow[]): Promise<{ checkedAt: string; statuses: ToolStatus[] }> {
  const checkedAt = new Date().toISOString();
  const statuses = await Promise.all(tools.map(probeTool));
  return { checkedAt, statuses };
}

function publicActivity(limit: number): { id: string; action: string; detail: string; createdAt: string }[] {
  return [
    { id: "activity-gateway", action: "Gateway initialized", detail: "The public player gateway is ready.", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "activity-network", action: "Partner network checked", detail: "All registered partner tools are available for launch.", createdAt: "2026-01-01T00:01:00.000Z" },
    { id: "activity-vip", action: "VIP Hub connected", detail: "Free partner access is active.", createdAt: "2026-01-01T00:02:00.000Z" },
  ].slice(0, limit);
}

// ---- Route handlers --------------------------------------------------------

async function handleGateway(db: D1Database, request: Request): Promise<Response> {
  await recordPublicVisit(db, "/gateway", request);
  const tools = await listTools(db);
  const health = await probeAll(tools);
  // Live manual announcements posted from the admin panel.
  let recentActivity: { id: string; action: string; detail: string; createdAt: string }[] = [];
  try {
    const now = new Date().toISOString();
    const cutoff = new Date(new Date(now).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db
      .prepare(
        "SELECT id, title, body, severity, created_at FROM announcements WHERE (expires_at IS NULL OR expires_at > ?) AND created_at > ? ORDER BY pinned DESC, id DESC LIMIT 12",
      )
      .bind(now, cutoff)
      .all<{ id: number; title: string; body: string; severity: string; created_at: string }>();
    recentActivity = ((rows.results ?? []) as { id: number; title: string; body: string; severity: string; created_at: string }[]).map((r) => ({
      id: `announcement-${r.id}`,
      action: r.title,
      detail: r.body ?? "",
      createdAt: r.created_at,
    }));
  } catch {
    recentActivity = [];
  }
  return jsonResponse(200, {
    user: { id: "public-player", displayName: "VIP PLAYER", joinedAt: "2026-01-01T00:00:00.000Z", vipAccess: true, activityCount: 3 },
    stats: {
      totalTools: tools.length,
      onlineTools: health.statuses.filter((s) => s.status === "online").length,
      activeSessions: 1,
    },
    tools: tools.map(toolToPublic),
    recentActivity: recentActivity.slice(0, 15),
  });
}

async function handleVipHub(db: D1Database, request: Request): Promise<Response> {
  await recordPublicVisit(db, "/vip", request);
  // VIP block enforcement: a blocked key loses access until it pays again.
  const hubKey = ((request.headers.get("x-member-key") ?? "") as string).trim().toUpperCase();
  let accessBlocked = false;
  let blockReason = "";
  if (hubKey) {
    const block = await db.prepare("SELECT reason FROM vip_blocks WHERE member_key = ?").bind(hubKey).first<{ reason: string | null }>();
    if (block) {
      accessBlocked = true;
      blockReason = block.reason ?? "Blocked by admin";
    }
  }
  const tools = await reorderTools(db, await listTools(db));
  const health = await probeAll(tools);
  const statusById = new Map(health.statuses.map((s) => [s.id, s.status]));
  return jsonResponse(200, {
    user: { id: "public-player", displayName: "VIP PLAYER", joinedAt: "2026-01-01T00:00:00.000Z", vipAccess: !accessBlocked },
    stats: {
      totalTools: tools.length,
      onlineTools: health.statuses.filter((s) => s.status === "online").length,
      activeSessions: 1,
    },
    tools: tools.map((tool) => ({ ...toolToPublic(tool), status: statusById.get(tool.id) ?? "online" })),
    recentActivity: [],
    accessBlocked,
    blockReason,
  });
}

async function handleBio(db: D1Database, request: Request): Promise<Response> {
  await recordPublicVisit(db, "/bio", request);
  const tools = await listTools(db, true);
  const bio = tools.find((tool) => tool.id === "bio");
  if (!bio) return jsonResponse(500, { error: "Bio tool not configured." });
  return jsonResponse(200, toolToPublic(bio));
}

async function handleLiveStatus(db: D1Database, request: Request): Promise<Response> {
  await recordPublicVisit(db, "/live", request);
  const tools = await listTools(db);
  const health = await probeAll(tools);
  try {
    await recordStatusHistory(db, health.statuses);
  } catch (err) {
    // History recording must never break the live-status response — log and continue.
    console.error("[history] record failed", (err as { message?: string })?.message ?? String(err));
  }
  return jsonResponse(200, health);
}

async function handleActivity(db: D1Database): Promise<Response> {
  let announcements: { id: string; action: string; detail: string; createdAt: string }[] = [];
  try {
    const now = new Date().toISOString();
    const cutoff = new Date(new Date(now).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db
      .prepare(
        "SELECT id, title, body, severity, created_at FROM announcements WHERE (expires_at IS NULL OR expires_at > ?) AND created_at > ? ORDER BY pinned DESC, id DESC LIMIT 50",
      )
      .bind(now, cutoff)
      .all<{ id: number; title: string; body: string; severity: string; created_at: string }>();
    announcements = ((rows.results ?? []) as { id: number; title: string; body: string; severity: string; created_at: string }[]).map((r) => ({
      id: `announcement-${r.id}`,
      action: r.title,
      detail: r.body ?? "",
      createdAt: r.created_at,
    }));
  } catch {
    announcements = [];
  }
  return jsonResponse(200, [...announcements, ...publicActivity(50)]);
}

export function generateMemberKey(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  const part = (n: number) =>
    Array.from(buf.slice(n, n + 3))
      .map((b) => b.toString(36).toUpperCase())
      .join("");
  return `RNS-${part(0)}-${part(3)}`;
}

// Public VIP membership: register (get a lifetime unique key), pay request, check status.
async function handleVipMember(db: D1Database, request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Use POST" });
  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as { name?: unknown; email?: unknown; memberKey?: unknown };
  const email = sanitizeInput(b.email).slice(0, 120);
  const existingKey = typeof b.memberKey === "string" ? b.memberKey.trim().toUpperCase() : "";
  if (existingKey) {
    // Returning user re-entering their saved key (e.g. new device or cleared browser data).
    // Name is not needed — the key itself proves membership.
    const row = await db.prepare("SELECT status FROM vip_members WHERE member_key = ?").bind(existingKey).first<{ status: string }>();
    if (!row) return jsonResponse(404, { ok: false, error: "This key was never registered. Check the spelling or register again." });
    return jsonResponse(200, { ok: true, memberKey: existingKey, status: row.status });
  }
  const name = sanitizeInput(b.name).slice(0, 60);
  if (!name) return jsonResponse(400, { ok: false, error: "Name is required" });
  const memberKey = generateMemberKey();
  await db
    .prepare("INSERT INTO vip_members (member_key, display_name, email, status, created_at) VALUES (?, ?, ?, 'registered', ?)")
    .bind(memberKey, name, email || null, new Date().toISOString())
    .run();
  return jsonResponse(200, { ok: true, memberKey, status: "registered" });
}

// Public: check whether a member key has lifetime VIP access.
async function handleVipStatus(db: D1Database, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim().toUpperCase();
  if (!key) return jsonResponse(400, { ok: false, error: "Key required" });
  const row = await db.prepare("SELECT status FROM vip_members WHERE member_key = ?").bind(key).first<{ status: string }>();
  if (!row) return jsonResponse(404, { ok: false, error: "Unknown key" });
  // A blocked member is treated as not-vip: gateway kicks them out until re-pay.
  const block = await db.prepare("SELECT reason FROM vip_blocks WHERE member_key = ?").bind(key).first<{ reason: string | null }>();
  if (block) {
    return jsonResponse(200, { ok: true, status: "blocked", reason: block.reason ?? "Blocked by admin" });
  }
  return jsonResponse(200, { ok: true, status: row.status });
}

// Public: submit a ₹20 payment request against a registered key.
async function handleVipPay(db: D1Database, request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Use POST" });
  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as { memberKey?: unknown };
  const key = (typeof b.memberKey === "string" ? b.memberKey : "").trim().toUpperCase();
  const member = await db.prepare("SELECT member_key, display_name, status FROM vip_members WHERE member_key = ?").bind(key).first<{
    member_key: string;
    display_name: string;
    status: string;
  }>();
  if (!member) return jsonResponse(404, { ok: false, error: "Key not registered. Register first." });
  if (member.status === "vip") return jsonResponse(200, { ok: true, status: "vip", message: "You already have lifetime VIP access!" });
  const existing = await db.prepare("SELECT id, status FROM vip_payments WHERE member_key = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(key).first<{ id: number; status: string }>();
  if (existing) return jsonResponse(200, { ok: true, status: "pending", message: "You already have a pending payment. Pay ₹20 to your UPI ID then tap 'I have paid'." });
  await db
    .prepare("INSERT INTO vip_payments (member_key, display_name, amount, status, created_at) VALUES (?, ?, 20, 'pending', ?)")
    .bind(key, member.display_name, new Date().toISOString())
    .run();
  return jsonResponse(200, { ok: true, status: "pending", message: "Payment request sent. Pay ₹20 then tap 'I have paid' — approval takes a few minutes." });
}

// Public: the UPI payment config shown on the payment screen (UPI ID + amount; QR image optional).
async function handleVipPayConfig(db: D1Database): Promise<Response> {
  const row = await db.prepare("SELECT value FROM site_config WHERE key = 'vip_payment_config'").first<{ value: string }>();
  let config: { upiId: string; upiName: string; amount: number; qrDataUrl: string } = { upiId: "", upiName: "RNS BIGBULL", amount: 20, qrDataUrl: "" };
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      config = {
        upiId: typeof parsed.upiId === "string" ? parsed.upiId : "",
        upiName: typeof parsed.upiName === "string" ? parsed.upiName : "RNS BIGBULL",
        amount: Number(parsed.amount) || 20,
        qrDataUrl: typeof parsed.qrDataUrl === "string" ? parsed.qrDataUrl : "",
      };
    } catch {
      /* keep defaults */
    }
  }
  return jsonResponse(200, config);
}

// Public: anonymous visitor stats for today (safe, read-only, no admin token).
async function handleVisitorStats(db: D1Database): Promise<Response> {
  const day = new Date().toISOString().slice(0, 10);
  const today = await db
    .prepare("SELECT COUNT(DISTINCT device) AS devices, SUM(requests) AS views FROM visit_counters WHERE day = ?")
    .bind(day)
    .first<{ devices: number; views: number }>();
  const total = await db
    .prepare("SELECT SUM(requests) AS views FROM visit_counters")
    .first<{ views: number }>();
  return jsonResponse(200, {
    today: {
      devices: Number((today && (today as { devices: unknown }).devices) ?? 0),
      pageViews: Number((today && (today as { views: unknown }).views) ?? 0),
    },
    totalViews: Number((total && (total as { views: unknown }).views) ?? 0),
  });
}

async function handleToolRequest(db: D1Database, request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Use POST" });
  const body = await request.json().catch(() => null);
  const b = (body ?? {}) as { name?: unknown; detail?: unknown; contact?: unknown };
  const name = sanitizeInput(b.name).slice(0, 120);
  if (!name) return jsonResponse(400, { ok: false, error: "Tool name is required" });
  const detail = sanitizeInput(b.detail).slice(0, 500);
  const contact = sanitizeInput(b.contact).slice(0, 120);
  await db
    .prepare("INSERT INTO tool_requests (name, detail, contact, status, created_at) VALUES (?, ?, ?, 'open', ?)")
    .bind(name, detail, contact, new Date().toISOString())
    .run();
  return jsonResponse(200, { ok: true, message: "Request saved — the admin will see it in the control panel." });
}

// ---- Entry -----------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }), request);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");

    try {
      if (path === "/healthz") return corsResponse(jsonResponse(200, { status: "ok" }), request);
      if (path === "/gateway") return corsResponse(await handleGateway(env.db, request), request);
      if (path === "/vip") return corsResponse(await handleVipHub(env.db, request), request);
      if (path === "/bio") return corsResponse(await handleBio(env.db, request), request);
      if (path === "/live-status") return corsResponse(await handleLiveStatus(env.db, request), request);
      if (path === "/activity") return corsResponse(await handleActivity(env.db), request);
      if (path === "/tool-request") return corsResponse(await handleToolRequest(env.db, request), request);
      if (path === "/vip-member") return corsResponse(await handleVipMember(env.db, request), request);
      if (path === "/vip-status") return corsResponse(await handleVipStatus(env.db, request), request);
      if (path === "/vip-pay") return corsResponse(await handleVipPay(env.db, request), request);
      if (path === "/vip-pay-config") return corsResponse(await handleVipPayConfig(env.db), request);
      if (path === "/visitor-stats") return corsResponse(await handleVisitorStats(env.db), request);
      {
        const ff = await handleFfTools(env.db, request, path);
        if (ff) return corsResponse(ff, request);
      }
      if (path.startsWith("/admin")) return corsResponse(await handleAdmin(env.db, request, path.slice("/admin".length)), request);
      if (path === "/music") {
        // Self-hosted uploaded music (stored base64 blob) is served directly as audio.
        const brow = await env.db.prepare("SELECT value FROM site_config WHERE key = 'gateway_music_blob'").first<{ value: string }>();
        if (brow?.value) {
          try {
            let bin = "";
            const b64 = brow.value;
            for (let i = 0; i < b64.length; i += 8192) {
              bin += atob(b64.slice(i, i + 8192));
            }
            const len = bin.length;
            const out = new Uint8Array(len);
            for (let i = 0; i < len; i += 1) out[i] = bin.charCodeAt(i);
            return corsResponse(
              new Response(out, {
                status: 200,
                headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=600" },
              }),
              request,
            );
          } catch {
            /* corrupted blob — fall through to the url lookup */
          }
        }
        const mrow = await env.db.prepare("SELECT value FROM site_config WHERE key = 'gateway_music_url'").first<{ value: string }>();
        return corsResponse(jsonResponse(200, { url: mrow?.value ?? null }), request);
      }
      if (path === "/banner") return await handleBanner(env.db, request);
      return jsonResponse(404, { error: "Route not found" });
    } catch (error) {
      const message = (error as { message?: string }).message ?? "Internal error";
      console.error("Worker error", message);
      return corsResponse(jsonResponse(502, { error: message }), request);
    }
  },
};
