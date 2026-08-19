import { useMemo } from 'react';
import { Atom, Check, Download, LoaderCircle, Megaphone, Smartphone } from 'lucide-react';
import { useInstallPrompt, useIsStandalone } from '@/hooks/use-install-prompt';
import { getGetGatewayQueryKey, getGetLiveStatusQueryKey, useGetGateway, useGetLiveStatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useEffect, useState } from 'react';
import { fetchBannerState, getVisitorStats } from '@/lib/admin';
import { Lock } from 'lucide-react';
import type { AdminMaintenance } from '@/lib/admin';
import { QueryError, QueryLoading } from '@/components/page-kit';
import { StatusPill } from '@/components/status-pill';


function formatClock(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function GatewayPage() {
  const query = useGetGateway({ query: { queryKey: getGetGatewayQueryKey() } });
  const liveStatusQuery = useGetLiveStatus({
    query: {
      queryKey: getGetLiveStatusQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const gateway = query.data;
  const bioTool = gateway?.tools.find((tool) => tool.id === 'bio');
  const liveTools = useMemo(
    () => liveStatusQuery.data?.statuses.filter((tool) => tool.id !== 'bio').slice(0, 4) ?? [],
    [liveStatusQuery.data?.statuses],
  );
  const onlineTools = liveStatusQuery.data?.statuses.filter((tool) => tool.status === 'online').length ?? 0;
  const isChecking = liveStatusQuery.isLoading || liveStatusQuery.isFetching;
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);
  const [stats, setStats] = useState<{ today: { devices: number; pageViews: number } } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getVisitorStats().then((data) => {
      if (cancelled) return;
      setStats(data);
    }).catch(() => {});
    const t = window.setInterval(() => {
      void getVisitorStats().then((data) => {
        if (cancelled) return;
        setStats(data);
      }).catch(() => {});
    }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    // Update banner strip without blocking the dashboard render.
    let cancelled = false;
    const load = () => {
      void fetchBannerState().then((state) => {
        if (cancelled) return;
        if (state.banner && state.banner.text) {
          setBanner(state.banner.text);
          setBannerText(state.banner.text);
        }
        setMaintenance(state.maintenance);
      });
    };
    load();
    const timer = window.setInterval(load, 5000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Scoped maintenance message for the dashboard banner strip (bio/vip/both).
  const maintenanceBanner = maintenance?.enabled && maintenance.message ? maintenance.message : null;

  // Per-dashboard lock states — a card under maintenance CANNOT be opened.
  const bioLocked = Boolean(maintenance?.enabled && (maintenance.scope === 'bio' || maintenance.scope === 'both'));
  const vipLocked = Boolean(maintenance?.enabled && (maintenance.scope === 'vip' || maintenance.scope === 'both'));
  const anyLocked = bioLocked || vipLocked;

  function lockLabel(locked: boolean) {
    return locked ? (maintenance?.scope === 'both' ? 'WHOLE SITE' : maintenance?.scope === 'bio' ? 'BIO TOOL' : 'VIP HUB') : null;
  }

  if (query.isLoading) return <QueryLoading label="OPENING PLAYER GATEWAY" />; // install hooks must come before early returns
  if (query.isError || !gateway || !bioTool) return <QueryError onRetry={() => query.refetch()} />;

  const stillConnecting = !liveStatusQuery.data && liveStatusQuery.isFetching;

  return <div className="route-in dashboard-page">
    {(banner || maintenanceBanner) ? (
      <button
        type="button"
        onClick={() => bannerText && setBannerOpen(true)}
        className="mx-auto mb-4 flex w-full max-w-4xl items-center gap-2 border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-left text-mono text-[10px] uppercase tracking-[.16em] text-amber-300 transition hover:bg-amber-300/20"
        data-testid="admin-banner-strip"
      >
        <Megaphone size={12} className="shrink-0" />
        <span className="truncate">{maintenanceBanner ?? banner}</span>
        <span className="ml-auto shrink-0 text-[9px] normal-case tracking-[.12em] text-amber-300/80">Tap to read</span>
      </button>
    ) : null}

    {bannerOpen && bannerText ? (
      <div className="banner-modal-backdrop" onClick={() => setBannerOpen(false)} role="dialog" aria-modal="true" data-testid="banner-popup">
        <div className="banner-modal" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-mono text-[10px] uppercase tracking-[.2em] text-amber-300">Site announcement</div>
            <button type="button" onClick={() => setBannerOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close" data-testid="button-close-banner-popup">✕</button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{bannerText}</p>
          <button type="button" onClick={() => setBannerOpen(false)} className="mt-4 self-end border border-accent/50 bg-accent/10 px-4 py-1.5 text-mono text-[9px] uppercase tracking-[.16em] text-accent hover:bg-accent/20" data-testid="button-close-banner">Got it</button>
        </div>
      </div>
    ) : null}

    <header className="dashboard-topbar">
      <div>
        <div className="dashboard-kicker">Player control center</div>
        <h1 className="dashboard-welcome">Welcome to the <span>{gateway.user.displayName}</span></h1>
        <p className="dashboard-subtitle">Ready to dominate today?</p>
      </div>
      <div className="network-nominal"><span className="signal-pulse" /> {stillConnecting ? <span className="inline-flex items-center gap-1.5"><LoaderCircle size={12} className="spin-slow" /> Connecting to gateway…</span> : isChecking ? 'Checking network' : 'Live network status'}</div>
    </header>

    <section className="dashboard-feature-grid" aria-label="Primary dashboards">
      <LockedCardWrap locked={bioLocked} scopeLabel={lockLabel(bioLocked)}>
        <article className="dashboard-feature-card dashboard-bio-card">
          <div className="dashboard-card-copy">
            <div className="dashboard-card-title-row"><h2>Bio Tool</h2><span className="dashboard-free-tag">FREE</span></div>
            <p>Powerful bio generator and customization tool.</p>
            {bioLocked ? (
              <div className="dashboard-action dashboard-action-locked" aria-disabled="true" data-testid="dashboard-bio-locked"><span>Locked — under maintenance</span><Lock size={12} aria-hidden="true" /></div>
            ) : (
              <a href={bioTool.url} target="_blank" rel="noreferrer" className="dashboard-action dashboard-action-purple" data-testid="button-dashboard-bio"><span>Launch Bio Tool</span><span aria-hidden="true">→</span></a>
            )}
          </div>
          <div className="dashboard-card-art dashboard-bio-art" aria-hidden="true"><Atom size={92} strokeWidth={1} /></div>
        </article>
      </LockedCardWrap>
      <LockedCardWrap locked={vipLocked} scopeLabel={lockLabel(vipLocked)}>
        <article className="dashboard-feature-card dashboard-vip-card">
          <div className="dashboard-card-copy">
            <div className="dashboard-card-title-row"><h2>VIP Hub</h2><span className="dashboard-free-tag dashboard-free-tag-green">FREE ACCESS</span></div>
            <p>All partner tools in one place.<br className="hidden sm:block" /> Fast. Safe. Always Online.</p>
            {vipLocked ? (
              <div className="dashboard-action dashboard-action-locked" aria-disabled="true" data-testid="dashboard-vip-locked"><span>Locked — under maintenance</span><Lock size={12} aria-hidden="true" /></div>
            ) : (
              <Link href="/vip" className="dashboard-action dashboard-action-gold" data-testid="button-dashboard-vip"><span>Open VIP Hub</span><span aria-hidden="true">→</span></Link>
            )}
          </div>
          <div className="dashboard-card-art dashboard-vip-art" aria-hidden="true"><span>♛</span></div>
        </article>
      </LockedCardWrap>
    </section>

    {/* Big floating caution banner — placed below the dashboard cards so a locked card stays visible and tappable */}
    {anyLocked && maintenance?.message ? (
      <CautionBanner
        message={maintenance.message}
        scopeLabel={maintenance.scope === 'both' ? 'whole network' : maintenance.scope === 'bio' ? 'Bio Tool' : 'VIP Hub'}
        scheduledEnd={maintenance?.scheduledEnd ?? null}
      />
    ) : null}

    <section className="dashboard-install-section" aria-label="Install app">
      <div className="dashboard-install-inner">
        <div>
          <div className="dashboard-install-label"><Smartphone size={13} strokeWidth={1.8} /><span>Install as app</span></div>
          <p className="dashboard-install-desc">Add RVRSED BIGBULL to your home screen and open it like a real app — full screen, no browser bar.</p>
          <InstallAppRow />
        </div>
        <div className="dashboard-install-art" aria-hidden="true"><span>♛</span></div>
      </div>
    </section>

    <section className="dashboard-lower-grid">
      <article className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><div className="dashboard-section-label">Live tools status</div><h2>Live tools</h2></div><div className="dashboard-online-count"><span /> {onlineTools} online</div></div>
        <div className="live-tool-grid">
          {liveTools.length === 0 ? <div className="py-5 text-xs text-muted-foreground">Checking partner tools…</div> : liveTools.map((tool) => <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="live-tool-item" data-testid={`dashboard-live-${tool.id}`}><span>{tool.name}</span><StatusPill status={tool.status} /></a>)}
        </div>
        <div className="dashboard-panel-footer"><Check size={13} /> {liveStatusQuery.data ? `Checked ${formatClock(liveStatusQuery.data.checkedAt)}` : 'Checking live availability'}</div>
        <div className="mt-3 border-t border-border pt-3">
          <div className="text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">Visitors today</div>
          <div className="mt-1 text-display text-lg font-bold text-accent">{stats?.today?.pageViews ?? '…'} views · {stats?.today?.devices ?? '…'} devices</div>
        </div>
      </article>
      <article className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><div className="dashboard-section-label">Event stream</div><h2>Recent activity</h2></div><Link href="/activity" className="dashboard-view-all">View All</Link></div>
        <div className="recent-activity-list">
          {gateway.recentActivity.slice(0, 4).map((item) => <div key={item.id} className="recent-activity-item" data-testid={`dashboard-activity-${item.id}`}><span className="activity-dot" /><div className="min-w-0 flex-1"><div className="truncate text-xs">{item.action}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{item.detail}</div></div><time className="text-mono text-[9px] text-muted-foreground">{formatClock(item.createdAt)}</time></div>)}
          {gateway.recentActivity.length === 0 && <div className="py-5 text-xs text-muted-foreground">Your account events will appear here.</div>}
        </div>
      </article>
    </section>

  </div>;
}

/** One-line install row: native button when available, else a copy-the-steps card. */
function InstallAppRow() {
  const install = useInstallPrompt();
  const standalone = useIsStandalone();

  if (standalone) return null;

  return (
    <div className="dashboard-install-row">
      {install ? (
        <button
          type="button"
          onClick={install}
          data-testid="button-install-app"
          className="dashboard-action dashboard-action-install"
        >
          <span><Download size={13} strokeWidth={1.8} className="align-middle" /> Install app</span>
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <div className="dashboard-install-steps" data-testid="text-install-steps">
          <span><Download size={13} strokeWidth={1.8} className="align-middle" /> Add to home screen</span>
          <span className="dashboard-install-sep">•</span>
          <span>Menu (⋮) → <b>Site controls</b> → <b>Add to Home screen</b>, or <b>Share…</b> → <b>Add to Home screen</b></span>
        </div>
      )}
    </div>
  );
}

/** Big floating caution banner (yellow/black sign style) shown when any dashboard is under maintenance. */
function CautionBanner({ message, scopeLabel, scheduledEnd }: { message: string; scopeLabel: string; scheduledEnd: string | null }) {
  const endsAt = scheduledEnd
    ? (() => {
        const d = new Date(scheduledEnd);
        return Number.isNaN(d.valueOf())
          ? null
          : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      })()
    : null;
  return (
    <div className="caution-overlay" data-testid="caution-banner" aria-live="polite">
      <div className="caution-sign">
        <div className="caution-head">
          <span className="caution-word">CAUTION</span>
          <span className="caution-sub">MAINTENANCE IN PROGRESS</span>
        </div>
        <div className="caution-body">
          <div className="caution-title">
            <span className="caution-triangle" aria-hidden="true">⚠</span> {scopeLabel} is temporarily offline
          </div>
          <p className="caution-message">{message || 'This dashboard is being upgraded and will be back shortly.'}</p>
          {endsAt ? (
            <div className="caution-time">
              <span className="caution-pulse" /> Auto-reopens at {endsAt} — no action needed
            </div>
          ) : (
            <div className="caution-time">
              <span className="caution-pulse" /> We will reopen it as soon as it is ready
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Wraps a dashboard card: dims it and blocks pointer events when it is under maintenance. */
function LockedCardWrap({ locked, scopeLabel, children }: { locked: boolean; scopeLabel: string | null; children: React.ReactNode }) {
  return (
    <div
      className={locked ? 'card-locked-wrapper' : undefined}
      {...(locked
        ? { 'aria-label': `${scopeLabel ?? 'This dashboard'} is under maintenance and cannot be opened` }
        : {})}
    >
      {children}
      {locked ? (
        <div className="card-locked-tag" data-testid="card-locked-tag">
          <span className="caution-pulse" /> {scopeLabel ?? 'LOCKED'} / MAINTENANCE
        </div>
      ) : null}
    </div>
  );
}
