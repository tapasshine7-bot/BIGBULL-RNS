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
export type AdminMaintenance = { enabled: boolean; message: string; scope: MaintenanceScope | null; scheduledEnd?: string | null } | null;

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
  const response = await fetch(adminApiPath(path), {
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

export async function adminToggleMaintenance(enabled: boolean, message: string, scope: MaintenanceScope = 'both', scheduledEnd: string | null = null) {
  return adminFetch<{ ok: boolean; enabled: boolean; message: string; scope: MaintenanceScope; scheduledEnd?: string | null }>('/maintenance/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled, message, scope, scheduledEnd }),
  });
}

export async function adminSetBanner(text: string, ttlHours: number | null) {
  return adminFetch<{ ok: boolean }>('/banner/set', {
    method: 'POST',
    body: JSON.stringify({ text, ttlHours }),
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
