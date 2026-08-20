// Free Fire companion tools + gateway extras — real D1-backed public endpoints.
// All endpoints are read-only for visitors; admin mutations live in admin.ts.
function safeJson(status: number, body: unknown, request: Request): Response {
  const resp = new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ["https://rnsbigbull.site", "https://www.rnsbigbull.site", "https://rnsbigbull-site.pages.dev"];
  if (allowed.includes(origin)) {
    resp.headers.set("access-control-allow-origin", origin);
    resp.headers.set("access-control-allow-credentials", "true");
    resp.headers.set("vary", "Origin");
  }
  return resp;
}

export interface FfToolsContext {
  db: D1Database;
  request: Request;
}

// ---------------------------------------------------------------------------
// Schema additions (idempotent)
// ---------------------------------------------------------------------------
export const FFTOOLS_SCHEMA = [
  // Sensitivity presets curated per device class.
  `CREATE TABLE IF NOT EXISTS ff_sensitivity_presets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     label TEXT NOT NULL,
     ram_gb TEXT NOT NULL,
     gyro TEXT NOT NULL DEFAULT 'off',
     dpi TEXT NOT NULL DEFAULT 'standard',
     values_json TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  // Skill-tier tips shown by the headshot calculator.
  `CREATE TABLE IF NOT EXISTS ff_headshot_tips (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     rating_min INTEGER NOT NULL,
     rating_max INTEGER NOT NULL,
     tier TEXT NOT NULL,
     tip_text TEXT NOT NULL
   )`,
  // Curated Free Fire news / patch notes / event calendar.
  `CREATE TABLE IF NOT EXISTS ff_news (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     body TEXT,
     category TEXT NOT NULL DEFAULT 'general',
     published_at TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  // UID lookup cache (public API fallback).
  `CREATE TABLE IF NOT EXISTS ff_uid_cache (
     uid TEXT PRIMARY KEY,
     name TEXT,
     level INTEGER,
     region TEXT,
     fetched_at TEXT NOT NULL
   )`,
  // Probe history for live-status graphs.
  `CREATE TABLE IF NOT EXISTS status_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     tool_id TEXT NOT NULL,
     ts TEXT NOT NULL,
     status TEXT NOT NULL,
     latency_ms INTEGER
   )`,
  // Bio templates gallery.
  `CREATE TABLE IF NOT EXISTS bio_templates (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     category TEXT NOT NULL DEFAULT 'gamer',
     title TEXT NOT NULL,
     template_text TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  // Per-tool "How to Use" guide cards inside VIP Hub.
  `CREATE TABLE IF NOT EXISTS vip_guide_cards (
     tool_id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     steps_json TEXT NOT NULL,
     tips_json TEXT,
     created_at TEXT NOT NULL
   )`,
  // Announcements shown on the gateway (vip-only or all visitors).
  `CREATE TABLE IF NOT EXISTS gateway_announcements (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     body TEXT,
     audience TEXT NOT NULL DEFAULT 'all',
     starts_at TEXT,
     ends_at TEXT,
     created_at TEXT NOT NULL
   )`,
];

export async function ensureFfToolsSchema(db: D1Database): Promise<void> {
  const batch = FFTOOLS_SCHEMA.map((sql) => db.prepare(sql));
  await db.batch(batch);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowIso(): string {
  return new Date().toISOString();
}

function jsonOf(row: { [key: string]: unknown }, col: string): unknown {
  const raw = row[col];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw as string);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// 1. Sensitivity Finder
// ---------------------------------------------------------------------------
// Deterministic, curated baseline: values scale with RAM and gyro usage.
// Community-proven anchor points per device class (no guarantees — labeled as recommendations).
function generateSensitivity(ram: string, gyro: string, dpi: string): Record<string, number | string> {
  const ramNum = parseInt(ram, 10);
  const ramKey = isNaN(ramNum) ? 4 : Math.max(2, Math.min(ramNum > 8 ? 8 : ramNum, 2));
  const useGyro = /on|always/i.test(gyro);
  const highDpi = /high|hdpi|fhd/i.test(dpi);

  // Anchor: 4GB non-gyro standard DPI
  const base = { general: 95, redDot: 90, scope2x: 82, scope4x: 74, awm: 60, freeLook: 78 };
  // Lower RAM devices run smoother with slightly lower values (fewer dropped frames on flick shots).
  const ramMult = ramKey <= 2 ? 0.86 : ramKey <= 3 ? 0.93 : ramKey >= 8 ? 1.06 : 1.0;
  // High DPI screens feel faster; reduce values so effective sensitivity stays constant.
  const dpiMult = highDpi ? 0.92 : 1.0;
  const m = ramMult * dpiMult;
  const round = (v: number) => Math.min(100, Math.max(1, Math.round(v)));

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) out[k] = round(v * m);
  if (useGyro) {
    out.gyroGeneral = round(300 * dpiMult);
    out.gyroRedDot = round(285 * dpiMult);
    out.gyroScope2x = round(255 * dpiMult);
    out.gyroScope4x = round(215 * dpiMult);
    out.gyroAwm = round(160 * dpiMult);
  }
  return out;
}

export async function handleSensitivityPresets(ctx: FfToolsContext): Promise<Response> {
  const rows = await ctx.db.prepare("SELECT id, label, ram_gb, gyro, dpi, values_json FROM ff_sensitivity_presets ORDER BY label").all();
  return safeJson(200, { presets: rows.results.map((r) => ({ ...r, values: jsonOf(r, "values_json") })), fetchedAt: nowIso() }, ctx.request);
}

export async function handleSensitivityCompute(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const ram = params.get("ram") ?? "4";
  const gyro = params.get("gyro") ?? "off";
  const dpi = params.get("dpi") ?? "standard";
  const values = generateSensitivity(ram, gyro, dpi);
  return safeJson(200, { ram, gyro, dpi, values, generatedAt: nowIso(), note: "Recommended values — tune slightly up/down to your own feel." }, ctx.request);
}

// ---------------------------------------------------------------------------
// 2. Headshot calculator
// ---------------------------------------------------------------------------
// Headshot ratio heuristic: HS% ≈ clamp(10 + 6.2*ln(KD) + 0.35*KD − 0.06*matches/100, 2, 98)
function computeHeadshotRatio(kd: number, matches: number): number {
  const lnKd = kd > 0 ? Math.log(kd) : 0;
  const raw = 10 + 6.2 * lnKd + 0.35 * kd - 0.0006 * matches;
  return Math.min(98, Math.max(2, Math.round(raw * 10) / 10));
}

function tierForRatio(ratio: number, tips: { tier: string; tip_text: string; rating_min: number; rating_max: number }[]): { tier: string; tip: string } | null {
  const hit = tips.find((t) => ratio >= t.rating_min && ratio < t.rating_max);
  return hit ? { tier: hit.tier, tip: hit.tip_text } : null;
}

export async function handleHeadshotTips(ctx: FfToolsContext): Promise<Response> {
  const rows = await ctx.db.prepare("SELECT id, rating_min, rating_max, tier, tip_text FROM ff_headshot_tips ORDER BY rating_min").all();
  return safeJson(200, { tips: rows.results, fetchedAt: nowIso() }, ctx.request);
}

export async function handleHeadshotCompute(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const kd = parseFloat(params.get("kd") ?? "0");
  const matches = parseInt(params.get("matches") ?? "0", 10);
  if (isNaN(kd) || kd < 0 || isNaN(matches) || matches < 0) {
    return safeJson(400, { ok: false, error: "Provide valid KD (number) and matches (number)." }, ctx.request);
  }
  const ratio = computeHeadshotRatio(kd, matches);
  const rows = await ctx.db.prepare("SELECT rating_min, rating_max, tier, tip_text FROM ff_headshot_tips ORDER BY rating_min").all();
  const tips = rows.results.map((r) => ({ ...r, rating_min: Number(r.rating_min), rating_max: Number(r.rating_max), tier: String(r.tier), tip_text: String(r.tip_text) }));
  const tier = tierForRatio(ratio, tips);
  return safeJson(200, { kd, matches, headshotRatio: ratio, tier: tier?.tier ?? "Unranked", tip: tier?.tip ?? "", computedAt: nowIso() }, ctx.request);
}

// ---------------------------------------------------------------------------
// 3. UID lookup (public FF profile API with cache fallback)
// ---------------------------------------------------------------------------
export async function handleUidLookup(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const uid = (params.get("uid") ?? "").trim();
  if (!/^\d{7,12}$/.test(uid)) {
    return safeJson(400, { ok: false, error: "Enter a valid Free Fire UID (7–12 digits)." }, ctx.request);
  }
  // Try the public profile lookup endpoint first.
  try {
    const resp = await fetch(`https://freefire-api.com/api/player/${uid}`, { method: "GET", headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, cf: { cacheTtl: 60 } });
    if (resp.ok) {
      const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
      if (data) {
        const profile = ((data?.data ?? data?.profile) || data) as Record<string, unknown>;
        const name = String((profile?.nickname ?? profile?.name ?? profile?.ign ?? "") as string | number);
        const level = Number((profile as Record<string, unknown>)?.level ?? ((profile as Record<string, unknown>)?.account as Record<string, unknown>)?.level ?? 0);
        const region = String(profile?.region ?? profile?.server ?? "");
        if (name) {
          ctx.db
            .prepare("INSERT INTO ff_uid_cache (uid, name, level, region, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name, level=excluded.level, region=excluded.region, fetched_at=excluded.fetched_at")
            .bind(uid, name, isNaN(level) ? 0 : level, region, nowIso())
            .run()
            .catch(() => undefined);
          return safeJson(200, { uid, name, level: isNaN(level) ? 0 : level, region, source: "live", fetchedAt: nowIso() }, ctx.request);
        }
      }
    }
  } catch {
    // fall through to cache
  }
  // Fallback: our cache.
  const cached = await ctx.db.prepare("SELECT uid, name, level, region, fetched_at FROM ff_uid_cache WHERE uid = ?").bind(uid).first();
  if (cached) {
    return safeJson(200, { uid, name: cached.name, level: Number(cached.level ?? 0), region: cached.region ?? "", source: "cached", fetchedAt: cached.fetched_at }, ctx.request);
  }
  return safeJson(404, { ok: false, error: "Profile not found. Check the UID or try again later." }, ctx.request);
}

// ---------------------------------------------------------------------------
// 4. FF news
// ---------------------------------------------------------------------------
export async function handleNews(ctx: FfToolsContext): Promise<Response> {
  const rows = await ctx.db.prepare("SELECT id, title, body, category, published_at FROM ff_news ORDER BY published_at DESC LIMIT 30").all();
  return safeJson(200, { news: rows.results, fetchedAt: nowIso() }, ctx.request);
}

// ---------------------------------------------------------------------------
// 5. Bio templates
// ---------------------------------------------------------------------------
export async function handleBioTemplates(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const category = params.get("category") ?? "";
  const sql = category
    ? "SELECT id, category, title, template_text FROM bio_templates WHERE category = ? ORDER BY id"
    : "SELECT id, category, title, template_text FROM bio_templates ORDER BY category, id";
  const rows = await (category ? ctx.db.prepare(sql).bind(category).all() : ctx.db.prepare(sql).all());
  return safeJson(200, { templates: rows.results, fetchedAt: nowIso() }, ctx.request);
}

// ---------------------------------------------------------------------------
// 6. VIP guide cards
// ---------------------------------------------------------------------------
export async function handleGuides(ctx: FfToolsContext): Promise<Response> {
  const rows = await ctx.db.prepare("SELECT tool_id, title, steps_json, tips_json FROM vip_guide_cards ORDER BY tool_id").all();
  return safeJson(200, { guides: rows.results.map((r) => ({ tool_id: r.tool_id, title: r.title, steps: jsonOf(r, "steps_json"), tips: jsonOf(r, "tips_json") })), fetchedAt: nowIso() }, ctx.request);
}

// ---------------------------------------------------------------------------
// 7. Status history (for live tools history graph)
// ---------------------------------------------------------------------------
export async function handleStatusHistory(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const toolId = params.get("tool") ?? "";
  const hours = Math.min(48, Math.max(1, parseInt(params.get("hours") ?? "12", 10)));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const rows = await ctx.db
    .prepare("SELECT tool_id, ts, status, latency_ms FROM status_history WHERE tool_id = ? AND ts >= ? ORDER BY ts")
    .bind(toolId, since)
    .all();
  return safeJson(200, { toolId, hours, points: rows.results.map((r) => ({ ts: r.ts, status: r.status, latencyMs: Number(r.latency_ms ?? 0) })), fetchedAt: nowIso() }, ctx.request);
}

// Called by the gateway probe loop after each probe round.
export async function recordStatusHistory(db: D1Database, statuses: Array<{ id: string; status: string; latencyMs: number | null }>): Promise<void> {
  if (statuses.length === 0) return;
  const ts = nowIso();
  try {
    const stmts = statuses.map((s) =>
      db.prepare("INSERT INTO status_history (tool_id, ts, status, latency_ms) VALUES (?, ?, ?, ?)").bind(s.id, ts, s.status, s.latencyMs ?? null),
    );
    const results = await db.batch(stmts);
    console.log(`[history] recorded ${stmts.length} status rows`);
    void results;
  } catch (err) {
    // batch rejected (e.g. single row error) — fall back to one-at-a-time inserts so no row is lost.
    for (const s of statuses) {
      try {
        await db.prepare("INSERT INTO status_history (tool_id, ts, status, latency_ms) VALUES (?, ?, ?, ?)").bind(s.id, ts, s.status, s.latencyMs ?? null).run();
      } catch {
        /* individual row may fail (constraint); skip and continue */
      }
    }
    console.log("[history] batch failed, fell back to per-row inserts");
  }
}

// ---------------------------------------------------------------------------
// 8. Gateway announcements
// ---------------------------------------------------------------------------
export async function handleAnnouncements(ctx: FfToolsContext): Promise<Response> {
  const vipOnly = paramsOf(ctx.request).get("vip") === "1";
  const audience = vipOnly ? "'vip'" : "'all'";
  const rows = await ctx.db
    .prepare(
      `SELECT id, title, body, audience, starts_at, ends_at FROM gateway_announcements
       WHERE (audience = ${audience})
       AND (starts_at IS NULL OR starts_at <= ?)
       AND (ends_at IS NULL OR ends_at > ?)
       ORDER BY starts_at DESC, id DESC LIMIT 10`,
    )
    .bind(nowIso(), nowIso())
    .all();
  return safeJson(200, { announcements: rows.results, fetchedAt: nowIso() }, ctx.request);
}

function paramsOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------
export async function handleFfTools(db: D1Database, request: Request, path: string): Promise<Response | null> {
  await ensureFfToolsSchema(db);
  const ctx: FfToolsContext = { db, request };
  const params = paramsOf(request);

  if (path === "/sensitivity/presets" && request.method === "GET") return handleSensitivityPresets(ctx);
  if (path === "/sensitivity/compute" && request.method === "GET") return handleSensitivityCompute(ctx, params);
  if (path === "/headshot/tips" && request.method === "GET") return handleHeadshotTips(ctx);
  if (path === "/headshot/compute" && request.method === "GET") return handleHeadshotCompute(ctx, params);
  if (path === "/uid/lookup" && request.method === "GET") return handleUidLookup(ctx, params);
  if (path === "/news" && request.method === "GET") return handleNews(ctx);
  if (path === "/bio-templates" && request.method === "GET") return handleBioTemplates(ctx, params);
  if (path === "/guides" && request.method === "GET") return handleGuides(ctx);
  if (path === "/live-status/history" && request.method === "GET") return handleStatusHistory(ctx, params);
  if (path === "/announcements" && request.method === "GET") return handleAnnouncements(ctx);
  return null;
}
