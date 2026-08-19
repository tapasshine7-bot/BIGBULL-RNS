// Hidden RNS Control console — no navigation link exists to this page.
// Access: /control with admin password (Tapas123 / Tapas@1234).

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  ClipboardList,
  Eye,
  EyeOff,
  Gauge,
  LoaderCircle,
  LogOut,
  Megaphone,
  Pencil,
  Radio,
  RefreshCcw,
  Siren,
  Trash2,
  Wrench,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { EmptyState } from '@/components/page-kit';
import {
  adminClearBanner,
  adminCreateIncident,
  adminGetAudit,
  adminGetIncidents,
  adminGetMaintenance,
  adminGetMonitors,
  adminGetNotifications,
  adminGetOverview,
  adminGetSummary,
  adminLogin,
  adminLogout,
  adminMarkNotificationsRead,
  adminResolveIncident,
  adminRunChecks,
  adminSetBanner,
  adminToggleMaintenance,
  fetchBannerState,
  readAdminToken,
  setAdminToken,
} from '@/lib/admin';

type TabId = 'overview' | 'monitors' | 'incidents' | 'broadcast' | 'notifications' | 'audit' | 'summary';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Gauge size={13} /> },
  { id: 'monitors', label: 'Monitors', icon: <Radio size={13} /> },
  { id: 'incidents', label: 'Incidents', icon: <Siren size={13} /> },
  { id: 'broadcast', label: 'Broadcast', icon: <Megaphone size={13} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
  { id: 'audit', label: 'Audit log', icon: <ClipboardList size={13} /> },
  { id: 'summary', label: 'Reports', icon: <Activity size={13} /> },
];

function formatTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ControlPage() {
  const [, setLocation] = useLocation();
  const [signedIn, setSignedIn] = useState<boolean>(Boolean(readAdminToken()));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');

  const [bannerText, setBannerText] = useState('');
  const [bannerTtl, setBannerTtl] = useState('24');

  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; scope: 'both' | 'bio' | 'vip' }>({ enabled: false, message: '', scope: 'both' });
  const [maintenanceScope, setMaintenanceScope] = useState<'both' | 'bio' | 'vip'>('both');
  const [maintenanceEnd, setMaintenanceEnd] = useState<string>('');
  const [overview, setOverview] = useState<{ total: number; green: number; yellow: number; red: number; openIncidents: number; averageUptime: number } | null>(null);
  const [monitors, setMonitors] = useState<Array<{ id: number; name: string; url: string; enabled: number; latest: { status: string; latency_ms: number | null; status_code: number | null; error: string | null; checked_at: string } | null }>>([]);
  const [incidents, setIncidents] = useState<Array<{ id: number; title: string; severity: string; status: string; note: string | null; created_at: string; resolved_at: string | null }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string; severity: string; is_read: number; created_at: string }>>([]);
  const [audit, setAudit] = useState<Array<{ id: number; actor: string; action: string; entity: string; severity: string; created_at: string }>>([]);
  const [summary, setSummary] = useState<{ checksLast24h: number; failuresLast24h: number; incidentsLast24h: number; adminActionsLast24h: number } | null>(null);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3400);
  }

  async function refreshAll() {
    const token = readAdminToken();
    if (!token) return;
    const [ov, mo, inc, nt, au, sm, mt, bn] = await Promise.allSettled([
      adminGetOverview(),
      adminGetMonitors(),
      adminGetIncidents(),
      adminGetNotifications(),
      adminGetAudit(),
      adminGetSummary(),
      adminGetMaintenance(),
      fetchBannerState(),
    ]);
    if (ov.status === 'fulfilled' && !('ok' in ov.value && ov.value.ok === false)) setOverview(ov.value as never);
    if (mo.status === 'fulfilled' && Array.isArray(mo.value)) setMonitors(mo.value);
    if (inc.status === 'fulfilled' && Array.isArray(inc.value)) setIncidents(inc.value);
    if (nt.status === 'fulfilled' && Array.isArray(nt.value)) setNotifications(nt.value);
    if (au.status === 'fulfilled' && Array.isArray(au.value)) setAudit(au.value);
    if (sm.status === 'fulfilled' && sm.value && typeof sm.value === 'object' && 'checksLast24h' in sm.value) setSummary(sm.value as never);
    if (mt.status === 'fulfilled' && mt.value && typeof mt.value === 'object' && 'enabled' in mt.value) setMaintenance(mt.value as never);
    // Banner state is only refreshed — maintenance already updated above.
    void bn;
  }

  useEffect(() => {
    if (signedIn) void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, tab]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginError(null);
    try {
      const result = await adminLogin({ password });
      if (result && result.ok && result.token) {
        setAdminToken(result.token);
        setSignedIn(true);
        setPassword('');
        flash('Signed in to the control console.');
      } else {
        setLoginError((result as { error?: string } | null)?.error ?? 'Sign-in failed.');
      }
    } catch {
      setLoginError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await adminLogout();
    setSignedIn(false);
    setLocation('/');
  }

  async function runChecksNow() {
    setBusyAction('checks');
    try {
      const result = await adminRunChecks();
      flash(result && (result as { ok?: boolean }).ok ? 'Network sweep complete — results updated.' : 'Sweep finished with partial data.');
      await refreshAll();
    } catch {
      flash('Sweep could not complete. Try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleMaintenance(next: boolean) {
    setBusyAction('maintenance');
    try {
      const end = next ? maintenanceEnd || null : null;
      const result = await adminToggleMaintenance(next, maintenance.message || (next ? 'Scheduled maintenance — back shortly.' : ''), maintenanceScope, end);
      if (result && (result as { ok?: boolean }).ok) {
        const updated = { enabled: next, message: (result as { message?: string }).message ?? maintenance.message, scope: (result as { scope?: 'both' | 'bio' | 'vip' }).scope ?? maintenanceScope, scheduledEnd: (result as { scheduledEnd?: string | null }).scheduledEnd ?? null };
        setMaintenance(updated);
        const scopeName = updated.scope === 'bio' ? 'Bio Tool' : updated.scope === 'vip' ? 'VIP Hub' : 'the whole site';
        flash(next ? `Maintenance mode is ON for ${scopeName}.` : 'Maintenance mode is OFF — site is live.');
      }
    } catch {
      flash('Could not update maintenance mode.');
    } finally {
      setBusyAction(null);
    }
  }

  async function pushBanner() {
    if (!bannerText.trim()) {
      flash('Write the banner text first.');
      return;
    }
    setBusyAction('banner');
    try {
      const ttl = Number(bannerTtl);
      const result = await adminSetBanner(bannerText.trim(), Number.isFinite(ttl) && ttl > 0 ? ttl : null);
      if (result && (result as { ok?: boolean }).ok) {
        flash('Banner pushed to all visitors.');
        setBannerText('');
        await refreshAll();
      }
    } catch {
      flash('Banner could not be pushed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function clearBanner() {
    setBusyAction('banner-clear');
    try {
      const result = await adminClearBanner();
      if (result && (result as { ok?: boolean }).ok) flash('Banner cleared.');
      await refreshAll();
    } finally {
      setBusyAction(null);
    }
  }

  async function createIncident() {
    if (!incidentTitle.trim()) return;
    setBusyAction('incident');
    try {
      const result = await adminCreateIncident(incidentTitle.trim(), 'warning');
      if (result && (result as { ok?: boolean }).ok) {
        flash('Incident logged.');
        setIncidentTitle('');
        await refreshAll();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function resolveIncident(id: number) {
    setBusyAction(`incident-${id}`);
    try {
      const result = await adminResolveIncident(id, 'Resolved from the control console.');
      if (result && (result as { ok?: boolean }).ok) {
        flash('Incident marked resolved.');
        await refreshAll();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function markNotificationsRead() {
    setBusyAction('notifications');
    try {
      const result = await adminMarkNotificationsRead(true);
      if (result && (result as { ok?: boolean }).ok) {
        flash('All notifications marked read.');
        await refreshAll();
      }
    } finally {
      setBusyAction(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Console (computed before the sign-in gate so hook ordering can never change)
  // ---------------------------------------------------------------------------

  const unreadCount = useMemo(() => notifications.filter((n) => n.is_read === 0).length, [notifications]);
  const refreshPending = busyAction !== null;

  if (!signedIn) {
    return (
      <div className="grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0b0e15] px-5 text-foreground">
        <div className="grid-surface absolute inset-0 opacity-40" />
        <div className="relative w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-between">
            <BrandMark compact />
            <div className="text-mono text-right text-[9px] uppercase tracking-[.22em] text-muted-foreground">
              <div>RNS CONTROL CONSOLE</div>
              <div className="mt-1 text-accent">ADMIN ACCESS</div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="border border-border bg-card/75 p-6 panel-edge">
            <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center border border-accent/40 text-accent">
                <Radio size={16} className="signal-pulse" />
              </div>
              <div>
                <div className="text-display text-lg font-bold uppercase tracking-wide">Operator sign-in</div>
                <div className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Restricted zone</div>
              </div>
            </div>
            <label className="text-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Admin password</label>
            <div className="relative mt-2 mb-5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full border border-border bg-background/60 px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition focus:border-accent/60"
                data-testid="input-admin-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {loginError && (
              <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-red-200">
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="w-full bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="button-admin-signin"
            >
              {busy ? 'Verifying…' : 'Enter control console'}
            </button>
            <div className="mt-5 text-center text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">
              Unauthorized access is logged
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Console
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[100dvh] bg-[#0b0e15] px-3 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div>
              <div className="text-display text-base font-bold uppercase tracking-wide">Control console</div>
              <div className="text-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">RNS BIGBULL / operator zone</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 border border-accent/40 px-2 py-1 text-mono text-[8px] uppercase tracking-[.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent signal-pulse" /> signed in
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 border border-border px-2 py-1 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground transition hover:border-destructive/50 hover:text-red-200"
              data-testid="button-admin-logout"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </header>

        {notice && (
          <div className="mb-3 border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent" data-testid="admin-notice">
            {notice}
          </div>
        )}

        <nav className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2.5" aria-label="Console sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 border px-2.5 py-1 text-mono text-[8px] uppercase tracking-[.16em] transition ${
                tab === item.id
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
              data-testid={`tab-${item.id}`}
            >
              {item.icon}
              {item.label}
              {item.id === 'notifications' && unreadCount > 0 ? (
                <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[8px] text-background">{unreadCount}</span>
              ) : null}
            </button>
          ))}
          <button
            onClick={() => void refreshAll()}
            disabled={refreshPending}
            className="ml-auto flex items-center gap-1.5 border border-border px-2.5 py-1 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            data-testid="button-admin-refresh"
          >
            <RefreshCcw size={12} className={refreshPending ? 'spin-slow' : undefined} /> Refresh
          </button>
        </nav>

        <section>
          {tab === 'overview' && <OverviewTab overview={overview} onSweep={runChecksNow} busy={busyAction === 'checks'} />}
          {tab === 'monitors' && (
            <MonitorsTab monitors={monitors} onSweep={runChecksNow} busy={busyAction === 'checks'} />
          )}
          {tab === 'incidents' && (
            <IncidentsTab
              incidents={incidents}
              onCreate={createIncident}
              onResolve={resolveIncident}
              busy={busyAction === 'incident' || busyAction?.startsWith('incident-')}
              title={incidentTitle}
              setTitle={setIncidentTitle}
            />
          )}
          {tab === 'broadcast' && (
            <BroadcastTab
              maintenanceScope={maintenanceScope}
              onScopeChange={setMaintenanceScope}
              scheduledEnd={maintenanceEnd}
              onScheduledEndChange={setMaintenanceEnd}
              bannerText={bannerText}
              setBannerText={setBannerText}
              bannerTtl={bannerTtl}
              setBannerTtl={setBannerTtl}
              maintenance={maintenance}
              onPushBanner={pushBanner}
              onClearBanner={clearBanner}
              onToggleMaintenance={toggleMaintenance}
              onMessageChange={(message) => setMaintenance((current) => ({ ...current, message }))}
              busyBanner={busyAction === 'banner' || busyAction === 'banner-clear'}
              busyMaintenance={busyAction === 'maintenance'}
            />
          )}
          {tab === 'notifications' && (
            <NotificationsTab notifications={notifications} onMarkRead={markNotificationsRead} busy={busyAction === 'notifications'} />
          )}
          {tab === 'audit' && <AuditTab audit={audit} />}
          {tab === 'summary' && <SummaryTab summary={summary} />}
        </section>

        <footer className="mt-8 border-t border-border pt-3 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">
          RNS Control Console / secured — every action is recorded in the audit log
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function StatBlock({ label, value, tone = 'foreground' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-border bg-card/60 px-3 py-2">
      <div className="text-mono text-[7px] uppercase tracking-[.2em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-display text-xl font-bold ${tone === 'accent' ? 'text-accent' : tone === 'red' ? 'text-red-300' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

type OverviewData = { total: number; green: number; yellow: number; red: number; openIncidents: number; averageUptime: number } | null;

function OverviewTab({ overview, onSweep, busy }: { overview: OverviewData; onSweep: () => void; busy?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onSweep}
          disabled={busy}
          className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
          data-testid="button-admin-sweep"
        >
          <RefreshCcw size={11} className={busy ? 'spin-slow' : undefined} /> Run network sweep now
        </button>
        <span className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">
          Checks every partner tool and records outcomes
        </span>
      </div>
      {overview ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatBlock label="Tracked tools" value={String(overview.total)} />
          <StatBlock label="Online" value={String(overview.green)} tone="accent" />
          <StatBlock label="Slow / warning" value={String(overview.yellow)} />
          <StatBlock label="Offline" value={String(overview.red)} tone="red" />
          <StatBlock label="Open incidents" value={String(overview.openIncidents)} tone={overview.openIncidents > 0 ? 'red' : 'foreground'} />
          <StatBlock label="Uptime 24h" value={`${overview.averageUptime}%`} tone="accent" />
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          <LoaderCircle size={12} className="spin-slow" /> Loading overview…
        </div>
      )}
    </div>
  );
}

function statusTone(status: string | null) {
  return status === 'green' ? 'text-accent' : status === 'yellow' ? 'text-amber-300' : status === 'red' ? 'text-red-300' : 'text-muted-foreground';
}

function MonitorsTab({ monitors, onSweep, busy }: { monitors: Array<Record<string, unknown>>; onSweep: () => void; busy?: boolean }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onSweep}
        disabled={busy}
          className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
          data-testid="button-monitor-sweep"
        >
          <RefreshCcw size={11} className={busy ? 'spin-slow' : undefined} /> Check every tool now
      </button>
      {monitors.length === 0 ? (
        <EmptyState title="No monitors" detail="Tracked tools appear here after a network sweep." />
      ) : (
        <div className="divide-y divide-border border border-border bg-card/50">
          {monitors.map((target) => {
            const t = target as { id: number; name: string; url: string; latest: { status: string; latency_ms: number | null; error: string | null; checked_at: string } | null };
            const latest = t.latest;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold">{t.name}</div>
                  <div className="text-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{t.url}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Status</div>
                    <div className={`text-mono text-[10px] uppercase tracking-[.16em] ${statusTone(latest?.status ?? null)}`}>
                      {latest?.status === 'green' ? 'Online' : latest?.status === 'yellow' ? 'Slow' : latest?.status === 'red' ? 'Offline' : 'Awaiting check'}
                    </div>
                  </div>
                  <div>
                    <div className="text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Latency</div>
                    <div className="text-mono text-[10px]">{latest?.latency_ms != null ? `${latest.latency_ms} ms` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Checked</div>
                    <div className="text-mono text-[10px]">{formatTime(latest?.checked_at ?? null)}</div>
                  </div>
                  {latest?.status === 'red' && latest?.error ? (
                    <div className="max-w-[200px] text-right text-[10px] text-red-300/80" title={latest.error}>
                      {latest.error}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IncidentsTab({
  incidents,
  onCreate,
  onResolve,
  busy,
  title,
  setTitle,
}: {
  incidents: Array<Record<string, unknown>>;
  onCreate: () => void;
  onResolve: (id: number) => void;
  busy?: boolean;
  title: string;
  setTitle: (value: string) => void;
}) {
  const open = incidents.filter((i) => (i as { status: string }).status === 'open');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border border-border bg-card/60 px-3 py-2">
        <Siren size={12} className="text-amber-300" />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Log a manual incident…"
          className="min-w-0 flex-1 border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-incident-title"
        />
        <button
          onClick={onCreate}
          disabled={busy || !title.trim()}
          className="border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-mono text-[8px] uppercase tracking-[.16em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
          data-testid="button-incident-create"
        >
          Log incident
        </button>
      </div>
      {incidents.length === 0 ? (
        <EmptyState title="No incidents" detail="Issues appear here automatically when a tool goes offline, or you can log one manually." />
      ) : (
        <div className="divide-y divide-border border border-border bg-card/50">
          {incidents.map((incident) => {
            const i = incident as { id: number; title: string; severity: string; status: string; note: string | null; created_at: string; resolved_at: string | null };
            return (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={11} className={i.status === 'open' ? 'text-red-300' : 'text-muted-foreground'} />
                    <span className="truncate text-xs font-medium">{i.title}</span>
                  </div>
                  <div className="text-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                    {formatTime(i.created_at)} {i.resolved_at ? `· resolved ${formatTime(i.resolved_at)}` : ''}
                  </div>
                </div>
                  <span className={`text-mono text-[7px] uppercase tracking-[.16em] ${i.status === 'open' ? 'border border-red-400/50 px-1.5 py-0.5 text-red-300' : 'border border-accent/40 px-1.5 py-0.5 text-accent'}`}>
                  {i.status}
                </span>
                {i.status === 'open' && (
                  <button
                    onClick={() => onResolve(i.id)}
                    className="flex items-center gap-1.5 border border-border px-2 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent"
                    data-testid={`button-incident-resolve-${i.id}`}
                  >
                    <BadgeCheck size={12} /> Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BroadcastTab({
  bannerText,
  setBannerText,
  bannerTtl,
  setBannerTtl,
  maintenance,
  onPushBanner,
  onClearBanner,
  onToggleMaintenance,
  onMessageChange,
  busyBanner,
  busyMaintenance,
  maintenanceScope,
  onScopeChange,
  scheduledEnd,
  onScheduledEndChange,
}: {
  bannerText: string;
  setBannerText: (value: string) => void;
  bannerTtl: string;
  setBannerTtl: (value: string) => void;
  maintenance: { enabled: boolean; message: string };
  onPushBanner: () => void;
  onClearBanner: () => void;
  onToggleMaintenance: (enabled: boolean) => void;
  onMessageChange: (message: string) => void;
  busyBanner: boolean;
  busyMaintenance: boolean;
  maintenanceScope: 'both' | 'bio' | 'vip';
  onScopeChange: (scope: 'both' | 'bio' | 'vip') => void;
  scheduledEnd: string;
  onScheduledEndChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="border border-border bg-card/60 px-3.5 py-3">
        <div className="mb-3 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <Megaphone size={13} className="text-accent" /> Update banner
        </div>
        <label className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Banner message</label>
        <textarea
          value={bannerText}
          onChange={(event) => setBannerText(event.target.value)}
          rows={2}
          maxLength={200}
          placeholder="Example: New update dropping tonight — stay tuned!"
          className="mt-1.5 w-full resize-none border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-banner-text"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Auto-hide after (hours, 0 = never)</label>
          <input
            type="number"
            min={0}
            max={720}
            value={bannerTtl}
            onChange={(event) => setBannerTtl(event.target.value)}
            className="w-20 border border-border bg-background/60 px-2 py-1.5 text-sm outline-none focus:border-accent/60"
            data-testid="input-banner-ttl"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onPushBanner}
            disabled={busyBanner}
            className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
            data-testid="button-banner-push"
          >
            <Pencil size={11} /> {busyBanner ? 'Pushing…' : 'Push banner'}
          </button>
          <button
            onClick={onClearBanner}
            disabled={busyBanner}
            className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-muted-foreground transition hover:text-red-200 disabled:opacity-50"
            data-testid="button-banner-clear"
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>
        <div className="mt-4 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          Banners appear at the top of the dashboard for every visitor.
        </div>
      </div>

      <div className="border border-border bg-card/60 px-3.5 py-3">
        <div className="mb-3 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <Wrench size={13} className="text-amber-300" /> Maintenance mode
        </div>
        <label className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Which dashboard</label>
        <div className="mt-1.5 flex gap-1.5">
          {(['both', 'bio', 'vip'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => onScopeChange(scope)}
              disabled={busyMaintenance}
              className={`border px-2.5 py-1 text-mono text-[8px] uppercase tracking-[.18em] transition disabled:opacity-50 ${
                maintenanceScope === scope
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`button-scope-${scope}`}
            >
              {scope === 'both' ? 'Both (whole site)' : scope === 'bio' ? 'Bio Tool' : 'VIP Hub'}
            </button>
          ))}
        </div>
        <label className="mt-3 text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Message shown to visitors</label>
        <textarea
          value={maintenance.message}
          onChange={(event) => onMessageChange(event.target.value)}
          rows={2}
          maxLength={300}
          placeholder="We are upgrading the network. Back in a few minutes."
          className="mt-1.5 w-full resize-none border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-maintenance-message"
        />
        <label className="mt-3 text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Auto-reopen at (leave empty = manual end)</label>
        <input
          type="datetime-local"
          value={scheduledEnd}
          onChange={(event) => onScheduledEndChange(event.target.value)}
          disabled={busyMaintenance}
          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
          className="mt-1.5 w-full border border-border bg-background/60 px-2.5 py-2 text-xs outline-none focus:border-accent/60"
          data-testid="input-maintenance-end"
        />
        <div className="mt-1 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">
          The site switches itself back ON at this exact time — no need to come back.
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => onToggleMaintenance(!maintenance.enabled)}
            disabled={busyMaintenance}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] transition disabled:opacity-50 ${
              maintenance.enabled
                ? 'border-red-400/60 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20'
            }`}
            data-testid="button-maintenance-toggle"
          >
            <ArrowLeftRight size={11} /> {maintenance.enabled ? 'Maintenance is ON — tap to end' : 'Start maintenance mode'}
          </button>
        </div>
        <div className="mt-4 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          {maintenanceScope === 'both'
            ? 'While ON, every visitor sees only the maintenance screen until you switch it off.'
            : `While ON, only the ${maintenanceScope === 'bio' ? 'Bio Tool' : 'VIP Hub'} shows the maintenance screen — the other dashboard keeps working.`}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({
  notifications,
  onMarkRead,
  busy,
}: {
  notifications: Array<Record<string, unknown>>;
  onMarkRead: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">
          System alerts from monitoring and admin actions
        </span>
        <button
          onClick={onMarkRead}
          disabled={busy}
          className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent disabled:opacity-50"
          data-testid="button-notifications-read"
        >
          <BadgeCheck size={12} /> Mark all read
        </button>
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" detail="Alerts appear here when a tool goes down or an admin action happens." />
      ) : (
        <div className="divide-y divide-border border border-border bg-card/50">
          {notifications.map((notification) => {
            const n = notification as { id: number; text: string; severity: string; is_read: number; created_at: string };
            return (
              <div key={n.id} className="flex items-start gap-2.5 px-3 py-2">
                <Bell size={11} className={n.severity === 'warning' ? 'mt-0.5 text-amber-300' : 'mt-0.5 text-accent'} />
                <div className="min-w-0 flex-1">
                  <div className={n.is_read === 1 ? 'text-xs text-muted-foreground' : 'text-xs'}>{n.text}</div>
                  <div className="text-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{formatTime(n.created_at)}</div>
                </div>
                {n.is_read === 0 ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditTab({ audit }: { audit: Array<Record<string, unknown>> }) {
  return audit.length === 0 ? (
    <EmptyState title="No audit entries yet" detail="Every admin action — logins, banner pushes, maintenance changes — is recorded here immutably." />
  ) : (
    <div className="divide-y divide-border border border-border bg-card/50">
      {audit.map((entry) => {
        const e = entry as { id: number; actor: string; action: string; entity: string; severity: string; created_at: string };
        return (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
            <div className="min-w-0 flex-1">
              <span className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">{e.action}</span>
              <span className="ml-2 text-mono text-[7px] uppercase tracking-[.14em] text-muted-foreground">
                {e.actor} / {e.entity}
              </span>
            </div>
            <div className="text-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{formatTime(e.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

type SummaryData = { checksLast24h: number; failuresLast24h: number; incidentsLast24h: number; adminActionsLast24h: number } | null;

function SummaryTab({ summary }: { summary: SummaryData }) {
  return summary ? (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatBlock label="Checks (24h)" value={String(summary.checksLast24h)} />
      <StatBlock label="Failures (24h)" value={String(summary.failuresLast24h)} tone={summary.failuresLast24h > 0 ? 'red' : 'accent'} />
      <StatBlock label="Incidents (24h)" value={String(summary.incidentsLast24h)} />
      <StatBlock label="Admin actions (24h)" value={String(summary.adminActionsLast24h)} />
    </div>
  ) : (
    <div className="flex items-center gap-2 border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          <LoaderCircle size={12} className="spin-slow" /> Loading report…
    </div>
  );
}
