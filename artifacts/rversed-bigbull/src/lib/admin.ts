// Hidden admin console API client (no workspace package dependency).
// Admin calls always use the SAME origin as the website (/api/admin/...) so
// mobile networks and security filters never treat them as cross-origin.
// The legacy workers.dev API host is only used when the environment variable
// explicitly forces a different host via `?api=workers` for self-testing.

const PRODUCTION_HOSTS = ['rnsbigbull.site', 'rnsbigbull-site.pages.dev'];

function isProductionHost(): boolean {
  return PRODUCTION_HOSTS.some((host) => window.location.hostname === host || window.location.hostname.endsWith(`.${host}`));
}

function getAdminApiOrigin(): string {
  if (!isProductionHost()) {
    const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (configured) {
      return new URL(configured, window.location.origin).origin;
    }
  }
  return window.location.origin;
}

export function getApiBaseUrl(): string {
  return getAdminApiOrigin();
}

export type AdminBanner = { text: string; expiresAt: string | null } | null;
export type MaintenanceScope = 'both' | 'bio' | 'vip';
export type AdminMaintenance = { enabled: boolean; message: string; scope: MaintenanceScope | null; mode?: 'maintenance' | 'update'; scheduledEnd?: string | null } | null;

interface AdminSession {
  token: string | null;
}

const SESSION_KEY = 'rbb_admin_session';

function readSession(): AdminSession {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { token: null };
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    return { token: parsed.token ?? null };
  } catch {
    return { token: null };
  }
}

function writeSession(token: string | null) {
  try {
    if (token) window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token }));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — console still functions without persistence.
  }
}

export function readAdminToken(): string | null {
  return readSession().token;
}

export function setAdminToken(token: string | null) {
  writeSession(token);
}

export function adminApiPath(path: string): string {
  return `${getApiBaseUrl()}/api/admin${path}`;
}

export function bannerApiPath(): string {
  return `${getApiBaseUrl()}/api/banner`;
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readAdminToken();
  // GET calls always get a fresh server answer — no stale cached JSON after refresh.
  const isGet = !options.method || options.method === 'GET';
  const url = isGet ? `${adminApiPath(path)}${path.includes('?') ? '&' : '?'}cb=${Date.now()}` : adminApiPath(path);
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as T | null;
  return (data ?? ({ ok: false, error: 'Network error' } as unknown as T));
}

export async function adminLogin(input: { password?: string; recovery?: string }) {
  return adminFetch<{ ok: boolean; token?: string; error?: string }>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function adminLogout() {
  try {
    await adminFetch<unknown>('/logout', { method: 'POST' });
  } finally {
    setAdminToken(null);
  }
}

export async function fetchBannerState(): Promise<{ banner: AdminBanner; maintenance: AdminMaintenance }> {
  try {
    const response = await fetch(bannerApiPath());
    if (!response.ok) throw new Error('network');
    const data = (await response.json()) as { banner?: AdminBanner; maintenance?: AdminMaintenance };
    return { banner: data.banner ?? null, maintenance: data.maintenance ?? { enabled: false, message: '', scope: null } };
  } catch {
    return { banner: null, maintenance: { enabled: false, message: '', scope: null } };
  }
}

export async function adminGetOverview() {
  return adminFetch<{
    total: number;
    green: number;
    yellow: number;
    red: number;
    openIncidents: number;
    averageUptime: number;
  }>('/overview');
}

export async function adminGetMonitors() {
  return adminFetch<
    Array<{
      id: number;
      name: string;
      url: string;
      enabled: number;
      latest: { status: string; latency_ms: number | null; status_code: number | null; error: string | null; checked_at: string } | null;
    }>
  >('/monitors');
}

export async function adminRunChecks() {
  return adminFetch<{ ok: boolean }>('/monitors/check', { method: 'POST' });
}

export async function adminGetIncidents() {
  return adminFetch<
    Array<{ id: number; title: string; severity: string; status: string; note: string | null; created_at: string; resolved_at: string | null }>
  >('/incidents');
}

export async function adminCreateIncident(title: string, severity: string) {
  return adminFetch<{ ok: boolean }>('/incidents', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', title, severity }),
  });
}

export async function adminResolveIncident(id: number, note: string) {
  return adminFetch<{ ok: boolean }>('/incidents', {
    method: 'POST',
    body: JSON.stringify({ action: 'resolve', id, note }),
  });
}

export async function adminGetMaintenance() {
  return adminFetch<AdminMaintenance>('/maintenance');
}

export async function adminToggleMaintenance(enabled: boolean, message: string, scope: MaintenanceScope = 'both', scheduledEnd: string | null = null, mode: 'maintenance' | 'update' = 'maintenance') {
  return adminFetch<{ ok: boolean; enabled: boolean; message: string; scope: MaintenanceScope; mode?: 'maintenance' | 'update'; scheduledEnd?: string | null }>('/maintenance/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled, message, scope, scheduledEnd, mode }),
  });
}

export async function adminSetBanner(text: string, ttlHours: number | null, startsAt: string | null = null) {
  return adminFetch<{ ok: boolean }>('/banner/set', {
    method: 'POST',
    body: JSON.stringify({ text, ttlHours, startsAt }),
  });
}

export async function adminClearBanner() {
  return adminFetch<{ ok: boolean }>('/banner/clear', { method: 'POST' });
}

export async function adminGetBanner() {
  return adminFetch<{ banner: AdminBanner; maintenance: AdminMaintenance }>('/banner');
}

export async function adminGetNotifications() {
  return adminFetch<Array<{ id: number; text: string; severity: string; is_read: number; created_at: string }>>('/notifications');
}

export async function adminMarkNotificationsRead(all = true) {
  return adminFetch<{ ok: boolean }>('/notifications/read', {
    method: 'POST',
    body: JSON.stringify(all ? { markAll: true } : {}),
  });
}

export async function adminGetAudit() {
  return adminFetch<Array<{ id: number; actor: string; action: string; entity: string; severity: string; created_at: string }>>('/audit');
}

export async function adminGetSummary() {
  return adminFetch<{ checksLast24h: number; failuresLast24h: number; incidentsLast24h: number; adminActionsLast24h: number }>('/summary');
}

// ---------------------------------------------------------------------------
// Site Ops features (emergency lock, announcements, stats, requests, ordering)
// ---------------------------------------------------------------------------

export async function adminEmergencyLock(locked: boolean) {
  return adminFetch<{ ok: boolean; locked: boolean }>('/lock', {
    method: 'POST',
    body: JSON.stringify({ locked }),
  });
}

export type AdminAnnouncement = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  pinned: number;
  created_at: string;
  expires_at: string | null;
};

export async function adminCreateAnnouncement(title: string, body: string, ttlHours: number | null = null) {
  return adminFetch<{ ok: boolean }>('/announcements', {
    method: 'POST',
    body: JSON.stringify({ title, body, ttlHours }),
  });
}

export async function adminGetAnnouncements() {
  return adminFetch<AdminAnnouncement[]>('/announcements');
}

export async function adminRemoveAnnouncement(id: number) {
  return adminFetch<{ ok: boolean }>('/announcements/remove', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function adminAnnounceBanner(text: string, ttlHours: number | null = null) {
  return adminFetch<{ ok: boolean }>('/banner/announce', {
    method: 'POST',
    body: JSON.stringify({ text, ttlHours }),
  });
}

export async function adminGetStats() {
  return adminFetch<{
    today: { devices: number; pageViews: number };
    totalDevices: number;
    topPaths: Array<{ path: string; visits: number }>;
    openToolRequests: number;
  }>('/stats');
}

export type AdminToolRequest = {
  id: number;
  name: string;
  detail: string | null;
  contact: string | null;
  status: string;
  created_at: string;
};

export async function adminGetRequests() {
  return adminFetch<AdminToolRequest[]>('/requests');
}

export async function adminMarkRequest(id: number, done: boolean) {
  return adminFetch<{ ok: boolean }>('/requests/mark', {
    method: 'POST',
    body: JSON.stringify({ id, action: done ? 'done' : 'open' }),
  });
}

export async function adminGetOrdering() {
  return adminFetch<Array<{ tool_id: string; position: number; updated_at: string }>>('/ordering');
}

export async function adminSetOrdering(toolId: string, position: number) {
  return adminFetch<{ ok: boolean }>('/ordering', {
    method: 'POST',
    body: JSON.stringify({ toolId, position }),
  });
}

export async function adminResetOrdering() {
  return adminFetch<{ ok: boolean }>('/ordering', {
    method: 'POST',
    body: JSON.stringify({ reset: true }),
  });
}

// Visitor tool-request submission (public, no login)
export async function submitToolRequest(name: string, detail: string, contact: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/tool-request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, detail, contact }),
    });
    if (!response.ok) throw new Error('network');
    const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
    return { ok: Boolean(data.ok), message: data.message ?? data.error ?? '' };
  } catch {
    return { ok: false, message: 'Network error' };
  }
}

// Record a page visit (anonymous counter, never fails the page)
export async function recordPageVisit() {
  try {
    void await fetch(`${getApiBaseUrl()}/api/healthz?visit=1`, { cache: 'no-store' });
  } catch {
    // best-effort
  }
}

export type AdminStats = {
  today: { devices: number; pageViews: number };
  totalDevices: number;
  topPaths: Array<{ path: string; visits: number }>;
  openToolRequests: number;
};

// Public anonymous visitor stats (no admin token needed — safe for the dashboard).
export async function getVisitorStats() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/visitor-stats`, { cache: 'no-store' });
    if (!response.ok) throw new Error('network');
    const data = (await response.json()) as { today?: { devices?: number; pageViews?: number }; totalViews?: number };
    return {
      today: {
        devices: Number(data.today?.devices ?? 0),
        pageViews: Number(data.today?.pageViews ?? 0),
      },
    };
  } catch {
    return { today: { devices: 0, pageViews: 0 } };
  }
}

// ---------------------------------------------------------------------------
// VIP membership + ₹20 payment (no login — lifetime unique key)
// ---------------------------------------------------------------------------

export type VipStatus = 'registered' | 'vip';

export async function vipRegister(name: string, email: string, existingKey?: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vip-member`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, memberKey: existingKey }),
    });
    const data = (await response.json()) as { ok?: boolean; memberKey?: string; status?: string; error?: string };
    return { ok: Boolean(data.ok), memberKey: data.memberKey ?? '', status: (data.status ?? '') as VipStatus, error: data.error ?? '' };
  } catch {
    return { ok: false, memberKey: '', status: '' as VipStatus, error: 'Network error' };
  }
}

export async function vipStatus(key: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vip-status?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    const data = (await response.json()) as { ok?: boolean; status?: string; error?: string };
    return { ok: Boolean(data.ok), status: (data.status ?? '') as VipStatus, error: data.error ?? '' };
  } catch {
    return { ok: false, status: '' as VipStatus, error: 'Network error' };
  }
}

export async function vipPay(memberKey: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vip-pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberKey }),
    });
    const data = (await response.json()) as { ok?: boolean; status?: string; message?: string; error?: string };
    return { ok: Boolean(data.ok), status: data.status ?? '', message: data.message ?? data.error ?? '' };
  } catch {
    return { ok: false, status: '', message: 'Network error' };
  }
}

export type VipPayConfig = { upiId: string; upiName: string; amount: number; qrDataUrl: string };

export async function vipPayConfig() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/vip-pay-config`, { cache: 'no-store' });
    const data = (await response.json()) as VipPayConfig;
    return data;
  } catch {
    return { upiId: '', upiName: 'RNS BIGBULL', amount: 20, qrDataUrl: '' } as VipPayConfig;
  }
}

// ---------------------------------------------------------------------------
// VIP admin endpoints (members, payments, UPI config, manual key generation)
// ---------------------------------------------------------------------------

export type AdminVipMember = {
  member_key: string;
  display_name: string;
  email: string | null;
  status: string;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
};

export type AdminVipPayment = {
  id: number;
  member_key: string;
  display_name: string;
  amount: number;
  status: string;
  created_at: string;
};

export async function adminGetVip() {
  return adminFetch<{ members: AdminVipMember[]; payments: AdminVipPayment[] }>('/vip');
}

export async function adminApproveVip(paymentId: number, memberKey: string, approve: boolean) {
  return adminFetch<{ ok: boolean }>('/vip/approve', {
    method: 'POST',
    body: JSON.stringify({ paymentId, memberKey, approve }),
  });
}

export async function adminGenerateVipKey(displayName: string, email?: string) {
  return adminFetch<{ ok: boolean; memberKey?: string; error?: string }>('/vip/generate', {
    method: 'POST',
    body: JSON.stringify({ displayName, email }),
  });
}

export async function adminVipConfigGet() {
  return adminFetch<VipPayConfig>('/vip/config');
}

export async function adminVipConfigSave(upiId: string, upiName: string, amount: number, qrDataUrl: string) {
  return adminFetch<{ ok: boolean }>('/vip/config', {
    method: 'POST',
    body: JSON.stringify({ upiId, upiName, amount, qrDataUrl }),
  });
}

// ---------------------------------------------------------------------------
// FF Studio — VIP analytics, gateway announcements, guide cards, tool ordering
// ---------------------------------------------------------------------------

export type AdminVipAnalytics = {
  totalMembers?: number;
  vipMembers?: number;
  pendingPayments?: number;
  revenueRs?: number;
};

export async function adminVipAnalytics() {
  return adminFetch<AdminVipAnalytics>('/vip/analytics');
}

export type AdminGatewayAnnouncement = {
  id: number;
  title: string;
  body: string | null;
  audience?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
};

export async function adminListGatewayAnnouncements() {
  return adminFetch<AdminGatewayAnnouncement[]>('/announcements');
}

export async function adminPostGatewayAnnouncement(title: string, body: string, audience = 'all', startsAt: string | null = null, endsAt: string | null = null) {
  return adminFetch<{ ok: boolean }>('/announcements', {
    method: 'POST',
    body: JSON.stringify({ title, body, audience, starts_at: startsAt, ends_at: endsAt }),
  });
}

export async function adminDeleteGatewayAnnouncement(id: number) {
  const token = readAdminToken();
  const response = await fetch(`${adminApiPath('/announcements')}/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
    },
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
  return { ok: Boolean(data?.ok) };
}

export type AdminGuideCard = { tool_id: string; title: string; steps?: string[]; tips?: string[] };

export async function adminPostGuides(guide: AdminGuideCard) {
  return adminFetch<{ ok: boolean }>('/guides', {
    method: 'POST',
    body: JSON.stringify(guide),
  });
}

export async function adminPostToolOrder(toolId: string, position: number) {
  return adminFetch<{ ok: boolean }>('/tool-order', {
    method: 'POST',
    body: JSON.stringify({ order: [{ tool_id: toolId, position }] }),
  });
}
