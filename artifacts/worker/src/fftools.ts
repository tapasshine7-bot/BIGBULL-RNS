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
// Free Fire sliders run 0–200 in both DEFAULT and HIGH sensitivity modes.
// Anchor values come from community-proven baselines (tune to your own feel).
function generateSensitivity(ram: string, gyro: string, dpi: string): Record<string, number | string> {
  const ramNum = parseInt(ram, 10);
  const ramKey = isNaN(ramNum) || ramNum <= 2 ? 2 : ramNum <= 3 ? 3 : ramNum <= 4 ? 4 : ramNum <= 6 ? 6 : 8;
  const useGyro = /on|always/i.test(gyro);
  const highDpi = /high|hdpi|fhd/i.test(dpi);

  // Anchor: 4GB device, non-gyro, standard DPI (DEFAULT mode baseline).
  // Values sit in the same range real players use (100–200 for general/heads).
  const base = { general: 158, redDot: 145, scope2x: 128, scope4x: 118, awm: 95, freeLook: 132 };
  // Lower RAM devices run smoother with slightly lower values (fewer dropped frames on flick shots).
  const ramMult = ramKey <= 2 ? 0.88 : ramKey <= 3 ? 0.94 : ramKey >= 8 ? 1.08 : 1.0;
  // High DPI screens feel faster; reduce values so effective sensitivity stays constant.
  const dpiMult = highDpi ? 0.93 : 1.0;
  const m = ramMult * dpiMult;
  // FF sensitivity sliders run 0–200 (both DEFAULT and HIGH modes).
  const round = (v: number) => Math.min(200, Math.max(1, Math.round(v)));

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) out[k] = round(v * m);
  if (useGyro) {
    out.gyroGeneral = round(190 * dpiMult);
    out.gyroRedDot = round(178 * dpiMult);
    out.gyroScope2x = round(150 * dpiMult);
    out.gyroScope4x = round(125 * dpiMult);
    out.gyroAwm = round(88 * dpiMult);
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
// Fetch the FULL profile from the FreeFireApi service (siambhau/FreeFireApi) when an API key
// is configured in site_config (key 'ff_api_key'). Falls back to live name/region only.
async function ffApiFullProfile(
  uid: string,
  apiKey: string,
  region: string,
): Promise<Record<string, unknown> | null> {
  const url = `http://siambhau69.eu.cc/freefireinfo/bhau?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}&key=${encodeURIComponent(apiKey)}`;
  try {
    const resp = await fetch(url, { method: "GET", cf: { cacheTtl: 300 } });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("image")) return null;
    let data: unknown;
    try {
      data = await resp.json();
    } catch {
      return null;
    }
    const obj = (data ?? {}) as Record<string, unknown>;
    return obj.basicInfo ? obj : null;
  } catch {
    return null;
  }
}

// Lookup a player profile via the free BD Games bazaar endpoint (works without API keys).
// Response shape: { region, nickname, ... } on success; a { url } captcha JSON on challenge.
async function ffLookupUpstream(uid: string): Promise<{ name: string; region: string } | null> {
  const payload = { app_id: 100067, login_id: uid };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; SM-A137F Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.39 Mobile Safari/537.36",
    "sec-ch-ua": '"Android WebView";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-platform": "Android",
    "sec-ch-ua-mobile": "?1",
    Origin: "https://bdgamesbazar.com",
    "X-Requested-With": "com.xbrowser.play",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Referer: "https://bdgamesbazar.com/?app=100067&channel=221070&item=67390",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9,bn-BD;q=0.8,bn;q=0.7",
    Cookie:
      "source=mb; region=BD; mspid2=80e513899ce7c59b2e61d208dd630a0b; _ga=GA1.1.1038399898.1733795308; datadome=sGHR4ZTAyW6zcAJXIvRZNOQTEWAFneXpFzU5XB9nZka7OA9o93bjtYTyy1e0IKx0FPY__JXhRgVoaEG5iV5G5PU2fnelMEuxCgqbuzWXCRELnAkmFPGgQFtSlBLEGeoh; session_key=4y34scvpgk2h8l0b5v1ppvxnzev6ov96; _ga_6F84K2JN88=GS1.1.1733795308.1.1.1733795370.0.0.0",
  };
  const resp = await fetch("https://bdgamesbazar.com/api/auth/player_id_login", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cf: { cacheTtl: 120 },
  });
  if (!resp.ok) return null;
  let data: unknown = null;
  try {
    data = await resp.json();
  } catch {
    return null;
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  const name = String(obj.nickname ?? obj.nick_name ?? obj.name ?? "");
  const region = String(obj.region ?? obj.server ?? "");
  // A challenge/captcha redirect response is NOT a profile.
  if (!name && obj.url) return null;
  if (!name) return null;
  return { name, region };
}

export async function handleUidLookup(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const uid = (params.get("uid") ?? "").trim();
  if (!/^\d{7,12}$/.test(uid)) {
    return safeJson(400, { ok: false, error: "Enter a valid Free Fire UID (7–12 digits)." }, ctx.request);
  }
  // Try the live profile lookup first.
  try {
    const hit = await ffLookupUpstream(uid);
    if (hit) {
      ctx.db
        .prepare("INSERT INTO ff_uid_cache (uid, name, level, region, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name, region=excluded.region, fetched_at=excluded.fetched_at")
        .bind(uid, hit.name, 0, hit.region, nowIso())
        .run()
        .catch(() => undefined);
      return safeJson(200, { uid, name: hit.name, level: 0, region: hit.region, source: "live", fetchedAt: nowIso() }, ctx.request);
    }
  } catch {
    // fall through to cache
  }
  // Fallback: admin-seeded profile (guaranteed to resolve).
  const seeded = await ctx.db.prepare("SELECT uid, name, region, created_at FROM uid_seed WHERE uid = ?").bind(uid).first<{ uid: string; name: string; region: string; created_at: string }>();
  if (seeded) {
    return safeJson(200, { uid, name: seeded.name, level: 0, region: seeded.region ?? "IND", source: "verified", fetchedAt: seeded.created_at }, ctx.request);
  }
  // Fallback: our cache.
  const cached = await ctx.db.prepare("SELECT uid, name, level, region, fetched_at FROM ff_uid_cache WHERE uid = ?").bind(uid).first();
  if (cached) {
    return safeJson(200, { uid, name: cached.name, level: Number(cached.level ?? 0), region: cached.region ?? "", source: "cached", fetchedAt: cached.fetched_at }, ctx.request);
  }
  return safeJson(404, { ok: false, error: "Profile not found. Check the UID or try again later." }, ctx.request);
}

// Deep profile lookup: name + region + the FreeFireApi full profile when an admin
// API key is configured. Falls back to the simple live lookup so it never errors out.
async function ffLookupDeep(uid: string): Promise<Record<string, unknown> | null> {
  let apiKey: string | null = null;
  try {
    const row = await ctxForDeep?.db.prepare("SELECT value FROM site_config WHERE key = 'ff_api_key'").first<{ value: string }>();
    apiKey = row?.value?.trim() || null;
  } catch {
    apiKey = null;
  }
  if (!apiKey) return null;
  let live: { name: string; region: string } | null = null;
  try {
    live = await ffLookupUpstream(uid);
  } catch {
    live = null;
  }
  const regionGuess = live?.region || "IND";
  let full: Record<string, unknown> | null = null;
  // Try region=IND first; if the profile lives elsewhere the API returns an error,
  // so retry with the live-detected region if it differs.
  try {
    full = await ffApiFullProfile(uid, apiKey, "IND");
    if (!full && regionGuess !== "IND") full = await ffApiFullProfile(uid, apiKey, regionGuess);
  } catch {
    full = null;
  }
  if (!full) {
    if (live) return { uid, name: live.name, region: live.region, source: "live" };
    return null;
  }
  const basic = (full.basicInfo ?? {}) as Record<string, unknown>;
  const profile = (full.profileInfo ?? {}) as Record<string, unknown>;
  const clan = (full.clanBasicInfo ?? {}) as Record<string, unknown>;
  const pet = (full.petInfo ?? {}) as Record<string, unknown>;
  const social = (full.socialInfo ?? {}) as Record<string, unknown>;
  const name = String(basic.nickname ?? live?.name ?? "");
  if (!name) return live ? { uid, name: live.name, region: live.region, source: "live" } : null;
  const regionFinal = String(basic.region ?? live?.region ?? "IND");
  return {
    uid,
    name,
    region: regionFinal,
    source: "full",
    level: Number(basic.level ?? 0),
    exp: Number(basic.exp ?? 0),
    rank: Number(basic.rank ?? 0),
    rankPoints: Number(basic.rankingPoints ?? 0),
    maxRank: Number(basic.maxRank ?? 0),
    liked: Number(basic.liked ?? 0),
    lastLoginAt: String(basic.lastLoginAt ?? ""),
    createAt: String(basic.createAt ?? ""),
    title: Number(basic.title ?? 0),
    bannerId: Number(basic.bannerId ?? 0),
    headPic: Number(basic.headPic ?? 0),
    clothes: Array.isArray(profile.clothes) ? (profile.clothes as unknown[]).map((c) => Number(c)) : [],
    equippedSkills: Array.isArray(profile.equipedSkills) ? (profile.equipedSkills as unknown[]).map((s) => Number(s)) : [],
    avatarId: Number(profile.avatarId ?? 0),
    petId: Number(pet.id ?? 0),
    petLevel: Number(pet.level ?? 0),
    petSkinId: Number(pet.skinId ?? 0),
    guildId: String(clan.clanId ?? ""),
    guildName: String(clan.clanName ?? ""),
    signature: String(social.signature ?? ""),
    gender: String(social.gender ?? ""),
    avatarUrl: `http://siambhau69.eu.cc/freefireinfo/bhau?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(regionFinal)}&key=${encodeURIComponent(apiKey)}`,
    fetchedAt: nowIso(),
  };
}

// Module-level handle for the deep lookup helper (set by index.ts before routing).
let ctxForDeep: FfToolsContext | null = null;
export function setFfToolsDeepContext(c: FfToolsContext): void {
  ctxForDeep = c;
}

export async function handleUidLookupDeep(ctx: FfToolsContext, params: URLSearchParams): Promise<Response> {
  const uid = (params.get("uid") ?? "").trim();
  if (!/^\d{7,12}$/.test(uid)) {
    return safeJson(400, { ok: false, error: "Enter a valid Free Fire UID (7–12 digits)." }, ctx.request);
  }
  setFfToolsDeepContext(ctx);
  const deep = await ffLookupDeep(uid);
  if (!deep) {
    const seeded = await ctx.db.prepare("SELECT uid, name, region, created_at FROM uid_seed WHERE uid = ?").bind(uid).first<{ uid: string; name: string; region: string; created_at: string }>();
    if (seeded) {
      return safeJson(200, { uid, name: seeded.name, level: 0, region: seeded.region ?? "IND", source: "verified", fetchedAt: seeded.created_at }, ctx.request);
    }
    return safeJson(404, { ok: false, error: "Profile not found. Check the UID or try again later." }, ctx.request);
  }
  // Cache the name/region for the simple endpoint too.
  try {
    ctx.db
      .prepare(
        "INSERT INTO ff_uid_cache (uid, name, level, region, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name, region=excluded.region, fetched_at=excluded.fetched_at",
      )
      .bind(uid, String(deep.name), Number((deep as Record<string, unknown>).level ?? 0), String(deep.region ?? ""), nowIso())
      .run();
  } catch {
    // ignore cache write failures
  }
  return safeJson(200, deep, ctx.request);
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
  if (path === "/uid/lookup-deep" && request.method === "GET") return handleUidLookupDeep(ctx, params);
  if (path === "/news" && request.method === "GET") return handleNews(ctx);
  if (path === "/bio-templates" && request.method === "GET") return handleBioTemplates(ctx, params);
  if (path === "/guides" && request.method === "GET") return handleGuides(ctx);
  if (path === "/live-status/history" && request.method === "GET") return handleStatusHistory(ctx, params);
  if (path === "/announcements" && request.method === "GET") return handleAnnouncements(ctx);
  return null;
}
