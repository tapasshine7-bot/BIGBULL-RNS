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
  Boxes,
  ClipboardList,
  Copy,
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
  adminAnnounceBanner,
  adminClearBanner,
  adminCreateAnnouncement,
  adminCreateIncident,
  adminEmergencyLock,
  adminGetAnnouncements,
  adminGetAudit,
  adminGetIncidents,
  adminGetMaintenance,
  adminGetMonitors,
  adminGetNotifications,
  adminGetOrdering,
  adminGetOverview,
  adminGetRequests,
  adminGetStats,
  adminGetSummary,
  adminLogin,
  adminLogout,
  adminMarkNotificationsRead,
  adminMarkRequest,
  adminRemoveAnnouncement,
  adminResetOrdering,
  adminResolveIncident,
  adminRunChecks,
  adminSetBanner,
  adminSetOrdering,
  adminToggleMaintenance,
  adminApproveVip,
  adminGenerateVipKey,
  adminGetVip,
  adminVipConfigGet,
  adminVipConfigSave,
  fetchBannerState,
  readAdminToken,
  setAdminToken,
} from '@/lib/admin';

type TabId = 'overview' | 'monitors' | 'incidents' | 'broadcast' | 'notifications' | 'audit' | 'summary' | 'siteops';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Gauge size={13} /> },
  { id: 'monitors', label: 'Monitors', icon: <Radio size={13} /> },
  { id: 'incidents', label: 'Incidents', icon: <Siren size={13} /> },
  { id: 'broadcast', label: 'Broadcast', icon: <Megaphone size={13} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
  { id: 'audit', label: 'Audit log', icon: <ClipboardList size={13} /> },
  { id: 'summary', label: 'Reports', icon: <Activity size={13} /> },
  { id: 'siteops', label: 'Site Ops', icon: <Boxes size={13} /> },
];

function formatTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
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
  const [bannerStart, setBannerStart] = useState('');

  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; scope: 'both' | 'bio' | 'vip' }>({ enabled: false, message: '', scope: 'both' });
  const [maintenanceScope, setMaintenanceScope] = useState<'both' | 'bio' | 'vip'>('both');
  const [maintenanceMode, setMaintenanceMode] = useState<'maintenance' | 'update'>('maintenance');
  const [maintenanceEnd, setMaintenanceEnd] = useState<string>('');
  const [overview, setOverview] = useState<{ total: number; green: number; yellow: number; red: number; openIncidents: number; averageUptime: number } | null>(null);
  const [monitors, setMonitors] = useState<Array<{ id: number; name: string; url: string; enabled: number; latest: { status: string; latency_ms: number | null; status_code: number | null; error: string | null; checked_at: string } | null }>>([]);
  const [incidents, setIncidents] = useState<Array<{ id: number; title: string; severity: string; status: string; note: string | null; created_at: string; resolved_at: string | null }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string; severity: string; is_read: number; created_at: string }>>([]);
  const [audit, setAudit] = useState<Array<{ id: number; actor: string; action: string; entity: string; severity: string; created_at: string }>>([]);
  const [summary, setSummary] = useState<{ checksLast24h: number; failuresLast24h: number; incidentsLast24h: number; adminActionsLast24h: number } | null>(null);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementTtl, setAnnouncementTtl] = useState('72');
  const [announcements, setAnnouncements] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [ordering, setOrdering] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<{ today: { devices: number; pageViews: number }; totalDevices: number; topPaths: Array<{ path: string; visits: number }> } | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // VIP membership + payments
  const [vipMembers, setVipMembers] = useState<Array<Record<string, unknown>>>([]);
  const [vipPayments, setVipPayments] = useState<Array<Record<string, unknown>>>([]);
  const [vipConfig, setVipConfig] = useState<{ upiId: string; upiName: string; amount: number; qrDataUrl: string }>({ upiId: '', upiName: 'RNS BIGBULL', amount: 20, qrDataUrl: '' });
  const [generateName, setGenerateName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [upiAmount, setUpiAmount] = useState('20');
  const [upiQr, setUpiQr] = useState('');

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3400);
  }

  async function refreshAll() {
    const token = readAdminToken();
    if (!token) return;
    const [ov, mo, inc, nt, au, sm, mt, bn, st, an, rq, ord, vp, vc] = await Promise.allSettled([
      adminGetOverview(),
      adminGetMonitors(),
      adminGetIncidents(),
      adminGetNotifications(),
      adminGetAudit(),
      adminGetSummary(),
      adminGetMaintenance(),
      fetchBannerState(),
      adminGetStats(),
      adminGetAnnouncements(),
      adminGetRequests(),
      adminGetOrdering(),
      adminGetVip(),
      adminVipConfigGet(),
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
    if (st.status === 'fulfilled' && st.value && typeof st.value === 'object' && 'today' in st.value) setStats(st.value as never);
    if (an.status === 'fulfilled' && Array.isArray(an.value)) setAnnouncements(an.value);
    if (rq.status === 'fulfilled' && Array.isArray(rq.value)) setRequests(rq.value);
    if (ord.status === 'fulfilled' && Array.isArray(ord.value)) setOrdering(ord.value);
    if (vp.status === 'fulfilled' && vp.value && typeof vp.value === 'object' && 'members' in vp.value) {
      const data = vp.value as { members?: unknown; payments?: unknown };
      if (Array.isArray(data.members)) setVipMembers(data.members);
      if (Array.isArray(data.payments)) setVipPayments(data.payments);
    }
    if (vc.status === 'fulfilled' && vc.value && typeof vc.value === 'object' && 'upiId' in vc.value) setVipConfig(vc.value as never);
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
      const result = await adminToggleMaintenance(next, maintenance.message || (next ? 'Scheduled maintenance — back shortly.' : ''), maintenanceScope, end, maintenanceMode);
      if (result && (result as { ok?: boolean }).ok) {
        const updated = { enabled: next, message: (result as { message?: string }).message ?? maintenance.message, scope: (result as { scope?: 'both' | 'bio' | 'vip' }).scope ?? maintenanceScope, mode: (result as { mode?: 'maintenance' | 'update' }).mode ?? maintenanceMode, scheduledEnd: (result as { scheduledEnd?: string | null }).scheduledEnd ?? null };
        setMaintenance(updated);
        const scopeName = updated.scope === 'bio' ? 'Bio Tool' : updated.scope === 'vip' ? 'VIP Hub' : 'the whole site';
        const modeName = updated.mode === 'update' ? 'Update' : 'Maintenance';
        flash(next ? `${modeName} mode is ON for ${scopeName}.` : `${modeName} mode is OFF — site is live.`);
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
      const result = await adminSetBanner(bannerText.trim(), Number.isFinite(ttl) && ttl > 0 ? ttl : null, bannerStart || null);
      if (result && (result as { ok?: boolean }).ok) {
        flash(bannerStart ? 'Banner scheduled — it appears automatically at the chosen time.' : 'Banner pushed to all visitors.');
        setBannerText('');
        setBannerStart('');
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

  async function pushAnnouncement() {
    if (!announcementTitle.trim()) {
      flash('Write the announcement title first.');
      return;
    }
    setBusyAction('announcement');
    try {
      const ttl = Number(announcementTtl);
      const result = await adminCreateAnnouncement(announcementTitle.trim(), announcementBody.trim(), Number.isFinite(ttl) && ttl > 0 ? ttl : null);
      if (result && (result as { ok?: boolean }).ok) {
        flash('Announcement added — visitors see it in the Activity feed.');
        setAnnouncementTitle('');
        setAnnouncementBody('');
        await refreshAll();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function removeAnnouncement(id: number) {
    setBusyAction(`announcement-${id}`);
    try {
      const result = await adminRemoveAnnouncement(id);
      if (result && (result as { ok?: boolean }).ok) flash('Announcement removed.');
      await refreshAll();
    } finally {
      setBusyAction(null);
    }
  }

  async function markRequest(id: number, done: boolean) {
    setBusyAction(`request-${id}`);
    try {
      const result = await adminMarkRequest(id, done);
      if (result && (result as { ok?: boolean }).ok) flash(done ? 'Tool request marked done.' : 'Tool request reopened.');
      await refreshAll();
    } finally {
      setBusyAction(null);
    }
  }

  async function setOrderPosition(toolId: string, position: string) {
    const p = Number(position);
    if (!Number.isFinite(p)) return;
    setBusyAction(`order-${toolId}`);
    try {
      const result = await adminSetOrdering(toolId, p);
      if (result && (result as { ok?: boolean }).ok) flash(`${toolId} position updated in VIP Hub.`);
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

  async function approveVipPayment(paymentId: number, memberKey: string, approve: boolean) {
    setBusyAction(`vip-${paymentId}`);
    try {
      const result = await adminApproveVip(paymentId, memberKey, approve);
      if (result && (result as { ok?: boolean }).ok) {
        flash(approve ? 'Payment approved — lifetime VIP access granted.' : 'Payment rejected.');
        await refreshAll();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function generateKeyForUser() {
    const name = generateName.trim();
    if (!name) {
      flash('Enter the user name first.');
      return;
    }
    setBusyAction('vip-generate');
    setGeneratedKey(null);
    try {
      const result = await adminGenerateVipKey(name);
      if (result && result.ok && result.memberKey) {
        setGeneratedKey(result.memberKey);
        flash(`Lifetime VIP key generated for ${name} — share it with the user.`);
        setGenerateName('');
        await refreshAll();
      } else {
        flash((result as { error?: string } | null)?.error ?? 'Key generation failed.');
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function saveVipConfig() {
    setBusyAction('vip-config');
    try {
      const amount = Number(upiAmount) || 20;
      const result = await adminVipConfigSave(upiId.trim(), upiName.trim() || 'RNS BIGBULL', amount, upiQr.trim());
      if (result && (result as { ok?: boolean }).ok) {
        flash('VIP payment config saved — the payment screen shows it instantly.');
        setVipConfig({ upiId: upiId.trim(), upiName: upiName.trim() || 'RNS BIGBULL', amount, qrDataUrl: upiQr.trim() });
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
              maintenanceMode={maintenanceMode}
              onModeChange={setMaintenanceMode}
              scheduledEnd={maintenanceEnd}
              onScheduledEndChange={setMaintenanceEnd}
              bannerText={bannerText}
              setBannerText={setBannerText}
              bannerTtl={bannerTtl}
              setBannerTtl={setBannerTtl}
              bannerStart={bannerStart}
              setBannerStart={setBannerStart}
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
          {tab === 'audit' && <AuditTab audit={audit} search={auditSearch} onSearchChange={setAuditSearch} />}
          {tab === 'summary' && <SummaryTab summary={summary} />}
          {tab === 'siteops' && (
            <SiteOpsTab
              stats={stats}
              announcements={announcements}
              requests={requests}
              ordering={ordering}
              announcementTitle={announcementTitle}
              setAnnouncementTitle={setAnnouncementTitle}
              announcementBody={announcementBody}
              setAnnouncementBody={setAnnouncementBody}
              announcementTtl={announcementTtl}
              setAnnouncementTtl={setAnnouncementTtl}
              onAnnounce={pushAnnouncement}
              onRemoveAnnouncement={removeAnnouncement}
              onRequestMark={markRequest}
              onOrderChange={setOrderPosition}
              onEmergencyLock={() => {
                setBusyAction('lock');
                void adminEmergencyLock(true).then((r) => {
                  if (r && (r as { ok?: boolean }).ok) flash('EMERGENCY LOCK — whole site is now under maintenance.');
                  void refreshAll();
                }).finally(() => setBusyAction(null));
              }}
              vipMembers={vipMembers}
              vipPayments={vipPayments}
              vipConfig={vipConfig}
              onRefreshVip={() => void refreshAll()}
              generateName={generateName}
              setGenerateName={setGenerateName}
              generatedKey={generatedKey}
              upiId={upiId}
              setUpiId={setUpiId}
              upiName={upiName}
              setUpiName={setUpiName}
              upiAmount={upiAmount}
              setUpiAmount={setUpiAmount}
              upiQr={upiQr}
              setUpiQr={setUpiQr}
              onGenerateKey={generateKeyForUser}
              onApproveVip={approveVipPayment}
              onSaveVipConfig={saveVipConfig}
              busyGenerate={busyAction === 'vip-generate'}
              busyApprove={busyAction?.startsWith('vip-') === true}
              busyConfig={busyAction === 'vip-config'}
              busyAnnouncement={Boolean(busyAction === 'announcement' || busyAction?.startsWith('announcement-'))}
              busyLock={Boolean(busyAction === 'lock')}
              busyRequest={Boolean(busyAction?.startsWith('request-'))}
              busyOrder={Boolean(busyAction?.startsWith('order-'))}
            />
          )}
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

function formatIST(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.valueOf())) return iso;
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  return `${ist.getUTCHours().toString().padStart(2, '0')}:${ist.getUTCMinutes().toString().padStart(2, '0')} IST`;
}

function BroadcastTab({
  bannerText,
  setBannerText,
  bannerTtl,
  setBannerTtl,
  bannerStart,
  setBannerStart,
  maintenance,
  onPushBanner,
  onClearBanner,
  onToggleMaintenance,
  onMessageChange,
  busyBanner,
  busyMaintenance,
  maintenanceScope,
  onScopeChange,
  maintenanceMode,
  onModeChange,
  scheduledEnd,
  onScheduledEndChange,
}: {
  bannerText: string;
  setBannerText: (value: string) => void;
  bannerTtl: string;
  setBannerTtl: (value: string) => void;
  bannerStart: string;
  setBannerStart: (value: string) => void;
  maintenance: { enabled: boolean; message: string; mode?: string; scheduledEnd?: string | null };
  onPushBanner: () => void;
  onClearBanner: () => void;
  onToggleMaintenance: (enabled: boolean) => void;
  onMessageChange: (message: string) => void;
  busyBanner: boolean;
  busyMaintenance: boolean;
  maintenanceScope: 'both' | 'bio' | 'vip';
  maintenanceMode: 'maintenance' | 'update';
  onModeChange: (mode: 'maintenance' | 'update') => void;
  scheduledEnd: string;
  onScheduledEndChange: (value: string) => void;
  onScopeChange: (scope: 'both' | 'bio' | 'vip') => void;
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
            <Pencil size={11} /> {busyBanner ? 'Pushing…' : bannerStart ? 'Schedule banner' : 'Push banner'}
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

      <div className={`px-3.5 py-3 ${maintenance.enabled ? (maintenanceMode === 'update' ? 'border border-amber-400/60 bg-amber-500/10' : 'border border-red-400/60 bg-red-500/10') : 'border border-border bg-card/60'}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
            <Wrench size={13} className="text-amber-300" /> {maintenance.enabled ? (maintenanceMode === 'update' ? 'Update mode is ON' : 'Maintenance mode is ON') : 'Maintenance / update mode'}
          </div>
          <div className="flex gap-1.5">
            {(['maintenance', 'update'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                disabled={busyMaintenance}
                className={`border px-2.5 py-1 text-mono text-[8px] uppercase tracking-[.18em] transition disabled:opacity-50 ${
                  maintenanceMode === mode
                    ? 'border-amber-400/70 bg-amber-400/20 text-amber-200'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`button-mode-${mode}`}
              >
                {mode === 'maintenance' ? 'Maintenance' : 'Update'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">
          Both lock the chosen dashboard — "Update" just says Update in the visitor banner instead of Maintenance.
        </div>
        <label className="mt-3 text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Which dashboard</label>
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onToggleMaintenance(!maintenance.enabled)}
            disabled={busyMaintenance}
            className={`flex flex-1 items-center justify-center gap-1.5 border px-3 py-2.5 text-mono text-[10px] uppercase tracking-[.18em] transition disabled:opacity-50 ${
              maintenance.enabled
                ? 'border-red-400/60 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                : 'border-amber-400/60 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
            }`}
            data-testid="button-maintenance-toggle"
          >
            {maintenance.enabled ? (
              <>
                <ArrowLeftRight size={12} /> {maintenanceMode === 'update' ? 'END UPDATE MODE' : 'END MAINTENANCE MODE'}
              </>
            ) : (
              <>
                <AlertTriangle size={12} /> Start {maintenanceMode === 'update' ? 'update' : 'maintenance'} mode
              </>
            )}
          </button>
        </div>
        {maintenance.enabled && (
          <div className={`mt-3 flex items-center gap-2 border px-3 py-2 ${maintenanceMode === 'update' ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-red-400/50 bg-red-500/15 text-red-200'}`}>
            <AlertTriangle size={12} />
            <span className="text-mono text-[9px] uppercase tracking-[.16em]">
              {maintenanceMode === 'update' ? 'UPDATE IN PROGRESS' : 'MAINTENANCE IN PROGRESS'} — {maintenanceScope === 'both' ? 'whole site' : maintenanceScope === 'bio' ? 'Bio Tool' : 'VIP Hub'} is locked
              {maintenance.scheduledEnd ? ` · reopens ${formatIST(maintenance.scheduledEnd)}` : ' · no auto-reopen set'}
            </span>
          </div>
        )}
        <div className="mt-4 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          {maintenanceScope === 'both'
            ? `While ON, every visitor sees only the ${maintenanceMode === 'update' ? 'update' : 'maintenance'} screen until you switch it off.`
            : `While ON, only the ${maintenanceScope === 'bio' ? 'Bio Tool' : 'VIP Hub'} shows the ${maintenanceMode === 'update' ? 'update' : 'maintenance'} screen — the other dashboard keeps working.`}
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

function AuditTab({
  audit,
  search,
  onSearchChange,
}: {
  audit: Array<Record<string, unknown>>;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? audit.filter((entry) => {
        const e = entry as { actor?: string; action?: string; entity?: string };
        return [e.action, e.actor, e.entity].some((part) => String(part ?? '').toLowerCase().includes(needle));
      })
    : audit;
  return (
    <div className="space-y-2.5">
      <div>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search actions — e.g. banner, maintenance, login"
          className="w-full border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-audit-search"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No audit entries yet" detail="Every admin action — logins, banner pushes, maintenance changes — is recorded here immutably." />
      ) : (
        <div className="divide-y divide-border border border-border bg-card/50">
          {filtered.map((entry) => {
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
      )}
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

// ---------------------------------------------------------------------------
// Site Ops tab — emergency lock, announcements, visitor stats, tool requests, ordering
// ---------------------------------------------------------------------------

function SiteOpsTab({
  stats,
  announcements,
  requests,
  ordering,
  announcementTitle,
  setAnnouncementTitle,
  announcementBody,
  setAnnouncementBody,
  announcementTtl,
  setAnnouncementTtl,
  onAnnounce,
  onRemoveAnnouncement,
  onRequestMark,
  onOrderChange,
  onEmergencyLock,
  vipMembers,
  vipPayments,
  vipConfig,
  generateName,
  setGenerateName,
  generatedKey,
  upiId,
  setUpiId,
  upiName,
  setUpiName,
  upiAmount,
  setUpiAmount,
  upiQr,
  setUpiQr,
  onGenerateKey,
  onApproveVip,
  onSaveVipConfig,
  onRefreshVip,
  busyGenerate,
  busyApprove,
  busyConfig,
  busyAnnouncement,
  busyLock,
  busyRequest,
  busyOrder,
}: {
  stats: { today: { devices: number; pageViews: number }; totalDevices: number; topPaths: Array<{ path: string; visits: number }> } | null;
  announcements: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
  ordering: Array<Record<string, unknown>>;
  announcementTitle: string;
  setAnnouncementTitle: (value: string) => void;
  announcementBody: string;
  setAnnouncementBody: (value: string) => void;
  announcementTtl: string;
  setAnnouncementTtl: (value: string) => void;
  onAnnounce: () => void;
  onRemoveAnnouncement: (id: number) => void;
  onRequestMark: (id: number, done: boolean) => void;
  onOrderChange: (toolId: string, position: string) => void;
  onEmergencyLock: () => void;
  busyAnnouncement: boolean;
  busyLock: boolean;
  busyRequest: boolean;
  busyOrder: boolean;
  vipMembers: Array<Record<string, unknown>>;
  vipPayments: Array<Record<string, unknown>>;
  vipConfig: { upiId: string; upiName: string; amount: number; qrDataUrl: string };
  generateName: string;
  setGenerateName: (value: string) => void;
  generatedKey: string | null;
  upiId: string;
  setUpiId: (value: string) => void;
  upiName: string;
  setUpiName: (value: string) => void;
  upiAmount: string;
  setUpiAmount: (value: string) => void;
  upiQr: string;
  setUpiQr: (value: string) => void;
  onGenerateKey: () => void;
  onApproveVip: (paymentId: number, memberKey: string, approve: boolean) => void;
  onSaveVipConfig: () => void;
  busyGenerate: boolean;
  busyApprove: boolean;
  busyConfig: boolean;
  onRefreshVip: () => void;
}) {
  const pendingPayments = vipPayments.filter((p) => (p as { status: string }).status === 'pending');

  // Continuous auto-scan: keeps members, payments, stats and visitors fresh while
  // the tab is open — safe under many simultaneous payments (read-only polling).
  useEffect(() => {
    const t = window.setInterval(() => void onRefreshVip(), 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshVip]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Emergency lock */}
      <div className="border border-red-400/30 bg-red-500/5 px-3.5 py-3">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide text-red-300">
          <Siren size={13} /> Emergency lock
        </div>
        <div className="mb-3 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          One tap locks the ENTIRE site under maintenance instantly — use only in emergencies.
        </div>
        <button
          onClick={onEmergencyLock}
          disabled={busyLock}
          className="flex w-full items-center justify-center gap-2 border border-red-400/60 bg-red-500/15 px-4 py-2.5 text-mono text-[9px] uppercase tracking-[.2em] text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
          data-testid="button-emergency-lock"
        >
          <span className="h-2 w-2 rounded-full bg-red-400 signal-pulse" /> {busyLock ? 'Locking…' : 'LOCK WHOLE SITE NOW'}
        </button>
      </div>

      {/* Visitor stats */}
      <div className="border border-border bg-card/60 px-3.5 py-3">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <Gauge size={13} className="text-accent" /> Visitor stats
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatBlock label="Page views (today)" value={String(stats.today.pageViews)} tone="accent" />
            <StatBlock label="Unique devices" value={String(stats.totalDevices)} />
            <div className="col-span-2 border border-border bg-background/40 p-2">
              <div className="mb-1.5 text-mono text-[7px] uppercase tracking-[.2em] text-muted-foreground">Top pages</div>
              {stats.topPaths.length === 0 ? (
                <div className="text-mono text-[8px] text-muted-foreground">No visits recorded yet — they appear as visitors browse.</div>
              ) : (
                stats.topPaths.map((row) => (
                  <div key={row.path} className="flex items-center justify-between text-mono text-[8px]">
                    <span className="text-foreground/80">{row.path}</span>
                    <span className="text-accent">{row.visits} visits</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle size={12} className="spin-slow" /> Loading stats…
          </div>
        )}
      </div>

      {/* Announcements */}
      <div className="border border-border bg-card/60 px-3.5 py-3">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <Megaphone size={13} className="text-accent" /> Post announcement
        </div>
        <div className="mb-2 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          Real posts that appear in the Activity feed for all visitors.
        </div>
        <input
          value={announcementTitle}
          onChange={(event) => setAnnouncementTitle(event.target.value)}
          maxLength={80}
          placeholder="Title — e.g. New partner added"
          className="w-full border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-announcement-title"
        />
        <textarea
          value={announcementBody}
          onChange={(event) => setAnnouncementBody(event.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Details (optional)"
          className="mt-2 w-full resize-none border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
          data-testid="input-announcement-body"
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">Auto-remove after (hours)</label>
          <input
            type="number"
            min={1}
            max={720}
            value={announcementTtl}
            onChange={(event) => setAnnouncementTtl(event.target.value)}
            className="w-16 border border-border bg-background/60 px-2 py-1 text-sm outline-none focus:border-accent/60"
            data-testid="input-announcement-ttl"
          />
          <button
            onClick={onAnnounce}
            disabled={busyAnnouncement || !announcementTitle.trim()}
            className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
            data-testid="button-announcement-post"
          >
            <Megaphone size={11} /> {busyAnnouncement ? 'Posting…' : 'Post'}
          </button>
        </div>
        <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto">
          {announcements.length === 0 ? (
            <div className="text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">No announcements yet.</div>
          ) : (
            announcements.map((a) => {
              const item = a as { id: number; title: string; body: string | null; expires_at: string | null; created_at: string };
              return (
                <div key={item.id} className="flex items-start justify-between gap-2 border border-border bg-background/40 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{item.title}</div>
                    <div className="text-mono text-[7px] uppercase tracking-[.14em] text-muted-foreground">
                      {formatTime(item.created_at)} {item.expires_at ? `· until ${formatTime(item.expires_at)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveAnnouncement(item.id)}
                    className="mt-0.5 shrink-0 border border-border px-1.5 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-red-200"
                    data-testid={`button-announcement-remove-${item.id}`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tool requests from visitors */}
      <div className="border border-border bg-card/60 px-3.5 py-3">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <ClipboardList size={13} className="text-accent" /> Tool requests
        </div>
        <div className="mb-2 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          Visitors ask for tools from the site — review here.
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {requests.length === 0 ? (
            <div className="text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">No requests yet.</div>
          ) : (
            requests.map((r) => {
              const item = r as { id: number; name: string; detail: string | null; contact: string | null; status: string; created_at: string };
              return (
                <div key={item.id} className="border border-border bg-background/40 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.name}</div>
                      {item.detail ? <div className="truncate text-mono text-[8px] text-muted-foreground">{item.detail}</div> : null}
                      <div className="text-mono text-[7px] uppercase tracking-[.14em] text-muted-foreground">
                        {formatTime(item.created_at)}
                        {item.contact ? ` · ${item.contact}` : ''}
                      </div>
                    </div>
                    <span className={`mt-0.5 shrink-0 border px-1.5 py-0.5 text-mono text-[7px] uppercase tracking-[.16em] ${item.status === 'done' ? 'border-accent/40 text-accent' : 'border-red-400/50 text-red-300'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      onClick={() => onRequestMark(item.id, item.status !== 'done')}
                      disabled={busyRequest}
                      className="border border-border px-2 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent disabled:opacity-50"
                      data-testid={`button-request-mark-${item.id}`}
                    >
                      {item.status === 'done' ? 'Reopen' : 'Mark done'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* VIP membership & payments */}
      <div className="border border-accent/30 bg-card/60 px-3.5 py-3 lg:col-span-2">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <BadgeCheck size={13} className="text-accent" /> VIP Hub — members, payments & keys
        </div>
        <div className="mb-2 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          Complete transaction history. If a user forgets their key, find it below and share it.
        </div>

        {/* Generate a key for a user manually */}
        <div className="mb-3 grid gap-2 border border-border bg-background/40 p-2.5 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-mono text-[7px] uppercase tracking-[.2em] text-muted-foreground">Generate a lifetime key for a user</div>
            <div className="mt-1.5 flex gap-2">
              <input
                value={generateName}
                onChange={(event) => setGenerateName(event.target.value)}
                maxLength={60}
                placeholder="User name"
                className="min-w-0 flex-1 border border-border bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent/60"
                data-testid="input-vip-generate-name"
              />
              <button
                onClick={onGenerateKey}
                disabled={busyGenerate || !generateName.trim()}
                className="flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
                data-testid="button-vip-generate-key"
              >
                {busyGenerate ? <LoaderCircle size={10} className="spin-slow" /> : <Copy size={11} />} {busyGenerate ? 'Creating…' : 'Generate'}
              </button>
            </div>
            {generatedKey ? (
              <div className="mt-2 flex items-center gap-2 border border-accent/50 bg-accent/10 px-2.5 py-2" data-testid="text-vip-generated-key">
                <code className="flex-1 break-all text-sm font-bold tracking-wider text-accent">{generatedKey}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(generatedKey)}
                  className="shrink-0 border border-border bg-card px-2 py-1 text-mono text-[7px] uppercase tracking-[.14em]"
                >
                  Copy
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* All members — key lookup */}
          <div>
            <div className="mb-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">All members ({vipMembers.length}) — copy any key</div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {vipMembers.length === 0 ? (
                <div className="border border-border bg-background/40 p-2 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">No members yet.</div>
              ) : (
                vipMembers.map((m) => {
                  const key = String((m as { member_key?: string }).member_key ?? '');
                  const name = String((m as { display_name?: string }).display_name ?? '—');
                  const status = String((m as { status?: string }).status ?? '');
                  const created = (m as { created_at?: string }).created_at ?? '';
                  return (
                    <div key={key} className="flex items-center gap-2 border border-border bg-background/40 px-2 py-1.5" data-testid={`vip-member-${key}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="truncate text-[10px] font-bold tracking-wider text-accent">{key}</code>
                          <span className={`shrink-0 border px-1 py-0.5 text-mono text-[6px] uppercase tracking-[.16em] ${status === 'vip' ? 'border-accent/40 text-accent' : 'border-border text-muted-foreground'}`}>{status}</span>
                        </div>
                        <div className="truncate text-[10px] text-foreground/80">{name} · {formatTime(created)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(key)}
                        className="shrink-0 border border-border px-1.5 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent"
                        data-testid={`button-vip-copy-key-${key}`}
                      >
                        <Copy size={9} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending payments */}
          <div>
            <div className="mb-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">Pending payments ({pendingPayments.length})</div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {pendingPayments.length === 0 ? (
                <div className="border border-border bg-background/40 p-2 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">Nothing waiting — great.</div>
              ) : (
                pendingPayments.map((p) => {
                  const paymentId = Number((p as { id?: number }).id ?? 0);
                  const key = String((p as { member_key?: string }).member_key ?? '');
                  const name = String((p as { display_name?: string }).display_name ?? '—');
                  return (
                    <div key={paymentId} className="border border-accent/40 bg-accent/5 px-2.5 py-2" data-testid={`vip-payment-${paymentId}`}>
                      <div className="flex items-center gap-2">
                        <code className="truncate text-[10px] font-bold tracking-wider text-accent">{key}</code>
                        <span className="text-[10px] text-foreground/80">· {name} · ₹{(p as { amount?: number }).amount ?? 20}</span>
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => onApproveVip(paymentId, key, true)}
                          disabled={busyApprove}
                          className="flex items-center gap-1 border border-accent/50 bg-accent/15 px-2 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-accent transition hover:bg-accent/25 disabled:opacity-50"
                          data-testid={`button-vip-approve-${paymentId}`}
                        >
                          {busyApprove ? <LoaderCircle size={9} className="spin-slow" /> : <BadgeCheck size={10} />} Approve
                        </button>
                        <button
                          onClick={() => onApproveVip(paymentId, key, false)}
                          disabled={busyApprove}
                          className="border border-border px-2 py-1 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground transition hover:text-red-200 disabled:opacity-50"
                          data-testid={`button-vip-reject-${paymentId}`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="mt-3">
          <div className="mb-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">Transaction history — all payments ({vipPayments.length})</div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {vipPayments.length === 0 ? (
              <div className="border border-border bg-background/40 p-2 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">No transactions yet.</div>
            ) : (
              vipPayments.map((p) => {
                const paymentId = Number((p as { id?: number }).id ?? 0);
                const key = String((p as { member_key?: string }).member_key ?? '');
                const name = String((p as { display_name?: string }).display_name ?? '—');
                const status = String((p as { status?: string }).status ?? '');
                const created = (p as { created_at?: string }).created_at ?? '';
                return (
                  <div key={paymentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-background/40 px-2.5 py-1.5" data-testid={`vip-history-${paymentId}`}>
                    <code className="text-[10px] font-bold tracking-wider text-accent">{key}</code>
                    <span className="text-[10px] text-foreground/80">{name}</span>
                    <span className="text-[10px] text-muted-foreground">₹{(p as { amount?: number }).amount ?? 20}</span>
                    <span className={`shrink-0 border px-1.5 py-0.5 text-mono text-[6px] uppercase tracking-[.16em] ${status === 'approved' ? 'border-accent/40 text-accent' : status === 'rejected' ? 'border-red-400/50 text-red-300' : 'border-border text-muted-foreground'}`}>{status}</span>
                    <span className="ml-auto text-mono text-[7px] uppercase tracking-[.14em] text-muted-foreground">{formatTime(created)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* UPI config */}
        <div className="mt-3 border border-border bg-background/40 p-2.5">
          <div className="mb-1.5 text-mono text-[7px] uppercase tracking-[.2em] text-muted-foreground">Payment screen config — shows on the user's ₹20 screen</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">UPI ID</div>
              <input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="yourname@upi" maxLength={80} className="mt-1 w-full border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-accent/60" data-testid="input-vip-upi-id" />
            </div>
            <div>
              <div className="text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">UPI name</div>
              <input value={upiName} onChange={(event) => setUpiName(event.target.value)} placeholder="Your Name" maxLength={60} className="mt-1 w-full border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-accent/60" data-testid="input-vip-upi-name" />
            </div>
            <div>
              <div className="text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">Amount (₹)</div>
              <input type="number" min={1} max={1000} value={upiAmount} onChange={(event) => setUpiAmount(event.target.value)} className="mt-1 w-full border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-accent/60" data-testid="input-vip-upi-amount" />
            </div>
            <div>
              <div className="text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">QR image URL (base64 data URL)</div>
              <input value={upiQr} onChange={(event) => setUpiQr(event.target.value)} placeholder="data:image/png;base64,…" maxLength={2000} className="mt-1 w-full border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-accent/60" data-testid="input-vip-upi-qr" />
            </div>
          </div>
          <button
            onClick={onSaveVipConfig}
            disabled={busyConfig || !upiId.trim()}
            className="mt-2 flex items-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-mono text-[8px] uppercase tracking-[.18em] text-accent transition hover:bg-accent/20 disabled:opacity-50"
            data-testid="button-vip-save-config"
          >
            {busyConfig ? <LoaderCircle size={10} className="spin-slow" /> : null} {busyConfig ? 'Saving…' : 'Save payment config'}
          </button>
          {vipConfig.upiId ? (
            <div className="mt-2 text-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">Current live config: {vipConfig.upiId} · ₹{vipConfig.amount}{vipConfig.upiName ? ` · ${vipConfig.upiName}` : ''}</div>
          ) : null}
        </div>
      </div>

      {/* Tool ordering */}
      <div className="border border-border bg-card/60 px-3.5 py-3 lg:col-span-2">
        <div className="mb-2.5 flex items-center gap-2 text-display text-sm font-bold uppercase tracking-wide">
          <Boxes size={13} className="text-accent" /> VIP Hub ordering
        </div>
        <div className="mb-2 text-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
          Lower position number = appears earlier in VIP Hub (empty = default order).
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(['bind', 'emote', 'like', 'gift', 'glory', 'reseller', 'allinone'].map((toolId) => {
            const current = (ordering.find((o) => (o as { tool_id: string }).tool_id === toolId) as { position?: number } | undefined)?.position ?? '';
            return (
              <div key={toolId} className="flex items-center gap-2 border border-border bg-background/40 px-2 py-1.5">
                <span className="text-mono text-[8px] uppercase tracking-[.14em] text-muted-foreground">{toolId}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="—"
                  value={String(current)}
                  onChange={(event) => onOrderChange(toolId, event.target.value)}
                  className="w-14 border border-border bg-background/60 px-2 py-1 text-sm outline-none focus:border-accent/60"
                  data-testid={`input-order-${toolId}`}
                />
                {busyOrder ? <LoaderCircle size={10} className="spin-slow text-accent" /> : null}
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
