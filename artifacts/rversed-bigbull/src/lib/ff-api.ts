// Public FF feature API helpers (read-only for visitors, no admin token).
// Uses the SAME origin as the website (/api/...) so mobile networks and security
// filters never treat them as cross-origin. The legacy workers.dev host is only
// used when VITE_API_BASE_URL explicitly forces a different host (self-testing).

const PRODUCTION_HOSTS = ['rnsbigbull.site', 'rnsbigbull-site.pages.dev'];

function getApiOrigin(): string {
  if (!PRODUCTION_HOSTS.some((host) => window.location.hostname === host || window.location.hostname.endsWith(`.${host}`))) {
    const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (configured) return new URL(configured, window.location.origin).origin;
  }
  return window.location.origin;
}

function apiUrl(path: string): string {
  return `${getApiOrigin()}/api${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as T | null;
  return data ?? ({} as T);
}

// ---------------------------------------------------------------------------
// 1. Sensitivity Finder
// ---------------------------------------------------------------------------
export type SensitivityPreset = {
  id: number;
  label: string;
  ram_gb: string;
  gyro: string;
  dpi: string;
  values_json: string;
  values?: Record<string, number>;
};

export async function getSensitivityPresets(): Promise<SensitivityPreset[]> {
  const data = await getJson<{ presets?: SensitivityPreset[] }>(`/sensitivity/presets`);
  return (data.presets ?? []).map((p) => ({ ...p, values: safeParseValues(p.values_json) }));
}

export async function computeSensitivity(ram: string, gyro: string, dpi: string) {
  return getJson<{ values?: Record<string, number>; note?: string }>(
    `/sensitivity/compute?ram=${encodeURIComponent(ram)}&gyro=${encodeURIComponent(gyro)}&dpi=${encodeURIComponent(dpi)}`,
  );
}

function safeParseValues(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// 2. Headshot Calculator
// ---------------------------------------------------------------------------
export async function computeHeadshot(kd: number, matches: number) {
  return getJson<{ headshotRatio?: number; tier?: string; tip?: string }>(
    `/headshot/compute?kd=${encodeURIComponent(String(kd))}&matches=${encodeURIComponent(String(matches))}`,
  );
}

// ---------------------------------------------------------------------------
// 3. UID Lookup
// ---------------------------------------------------------------------------
export async function lookupUid(uid: string) {
  const data = await getJson<{ name?: string; level?: number; region?: string; source?: string; error?: string }>(
    `/uid/lookup?uid=${encodeURIComponent(uid)}`,
  );
  return data;
}

// Deep profile lookup — full player details (level, rank, likes, outfit, pet, guild,
// signature, avatar banner) when the admin has configured a FreeFireApi key.
export interface DeepProfile {
  uid: string;
  name: string;
  region: string;
  source: string;
  level?: number;
  exp?: number;
  rank?: number;
  rankPoints?: number;
  maxRank?: number;
  liked?: number;
  lastLoginAt?: string;
  createAt?: string;
  title?: number;
  clothes?: number[];
  petId?: number;
  petLevel?: number;
  petSkinId?: number;
  guildId?: string;
  guildName?: string;
  signature?: string;
  gender?: string;
  avatarUrl?: string;
  error?: string;
}

export async function lookupUidDeep(uid: string): Promise<DeepProfile | null> {
  const data = await getJson<DeepProfile | null>(`/uid/lookup-deep?uid=${encodeURIComponent(uid)}`);
  return data;
}

// ---------------------------------------------------------------------------
// 4. FF News
// ---------------------------------------------------------------------------
export type NewsItem = { id: number; title: string; body: string | null; category: string; published_at: string };

export async function getNews(): Promise<NewsItem[]> {
  const data = await getJson<{ news?: NewsItem[] }>(`/news`);
  return data.news ?? [];
}

// ---------------------------------------------------------------------------
// 5. Bio templates
// ---------------------------------------------------------------------------
export type BioTemplate = { id: number; category: string; title: string; template_text: string };

export async function getBioTemplates(category?: string) {
  const path = category ? `/bio-templates?category=${encodeURIComponent(category)}` : `/bio-templates`;
  const data = await getJson<{ templates?: BioTemplate[] }>(path);
  return data.templates ?? [];
}

// ---------------------------------------------------------------------------
// 6. VIP guide cards
// ---------------------------------------------------------------------------
export type GuideCard = { tool_id: string; title: string; steps?: Array<string | { step?: string; text?: string }>; tips?: Array<string> };

export async function getGuides(): Promise<GuideCard[]> {
  const data = await getJson<{ guides?: GuideCard[] }>(`/guides`);
  return data.guides ?? [];
}

// ---------------------------------------------------------------------------
// 7. Live-status history
// ---------------------------------------------------------------------------
export async function getStatusHistory(tool: string, hours = 12) {
  return getJson<{ toolId?: string; hours?: number; points?: Array<{ ts: string; status: string; latencyMs: number }> }>(
    `/live-status/history?tool=${encodeURIComponent(tool)}&hours=${encodeURIComponent(String(hours))}`,
  );
}

// ---------------------------------------------------------------------------
// 9. Gateway announcements
// ---------------------------------------------------------------------------
export type Announcement = { id: number; title: string; body: string | null; audience?: string; starts_at?: string | null; ends_at?: string | null };

export async function getAnnouncements(): Promise<Announcement[]> {
  const data = await getJson<{ announcements?: Announcement[] }>(`/announcements`);
  return data.announcements ?? [];
}
