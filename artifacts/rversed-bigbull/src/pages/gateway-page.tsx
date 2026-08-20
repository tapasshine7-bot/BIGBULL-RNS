import { useMemo } from 'react';
import { Activity, Atom, Bell, Check, ChevronRight, Download, History, LoaderCircle, Megaphone, Smartphone } from 'lucide-react';
import { useInstallPrompt, useIsStandalone } from '@/hooks/use-install-prompt';
import { getGetGatewayQueryKey, getGetLiveStatusQueryKey, useGetGateway, useGetLiveStatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { getAnnouncements, getStatusHistory, type Announcement } from '@/lib/ff-api';

function RestoreKeyPanel({ status, error, value, onChange, onClose, onConfirm }: {
  status: null | 'loading' | 'ok' | 'err';
  error: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="restore-panel" data-testid="emergency-key-panel" role="dialog" aria-modal="true">
      {status === 'ok' ? (
        <div className="restore-result restore-ok">
          <span>✓</span>
          <span>VIP key restored — opening your VIP Hub…</span>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-mono text-[9px] uppercase tracking-[.2em] text-amber-300">Emergency access</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">Restore your VIP key</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Paste the unique key the admin gave you (or your saved key). It works on any phone and restores your lifetime VIP access.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="mt-1 shrink-0 text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="RNS-XXXXX-XXXXXX"
            value={value}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="restore-input"
            data-testid="input-restore-key"
          />
          {error ? <div className="mt-2 text-[11px] leading-4 text-red-400" data-testid="text-restore-error">{error}</div> : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={status === 'loading'}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-accent/60 bg-accent/15 px-4 py-2 text-mono text-[10px] uppercase tracking-[.16em] text-accent transition hover:bg-accent/25 disabled:opacity-50"
            data-testid="button-restore-confirm"
          >
            {status === 'loading' ? <span className="inline-flex items-center gap-2"><LoaderCircle size={13} className="spin-slow" /> Restoring…</span> : 'Restore my VIP access'}
          </button>
        </>
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { fetchBannerState, getVisitorStats, vipRegister } from '@/lib/admin';
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
    () =>
      (liveStatusQuery.data?.statuses.filter((tool) => tool.id !== 'bio').slice(0, 4) ?? []).map(
        (tool) => ({
          ...tool,
          name: gateway?.tools.find((entry: { id: string; name?: string }) => entry.id === tool.id)?.name ?? tool.id,
        }),
      ),
    [liveStatusQuery.data?.statuses, gateway?.tools],
  );
  const onlineTools = liveStatusQuery.data?.statuses.filter((tool) => tool.status === 'online').length ?? 0;
  const isChecking = liveStatusQuery.isLoading || liveStatusQuery.isFetching;
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);
  const [stats, setStats] = useState<{ today: { devices: number; pageViews: number } } | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<null | 'loading' | 'ok' | 'err'>(null);
  const [restoreError, setRestoreError] = useState('');
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

  // Scoped maintenance/update message for the dashboard banner strip (bio/vip/both).
  const maintenanceBanner = maintenance?.enabled && maintenance.message ? maintenance.message : null;
  const isUpdateMode = Boolean(maintenance?.enabled && maintenance.mode === 'update');

  // Per-dashboard lock states — a card under maintenance CANNOT be opened.
  const bioLocked = Boolean(maintenance?.enabled && (maintenance.scope === 'bio' || maintenance.scope === 'both'));
  const vipLocked = Boolean(maintenance?.enabled && (maintenance.scope === 'vip' || maintenance.scope === 'both'));
  const anyLocked = bioLocked || vipLocked;

  function lockLabel(locked: boolean) {
    return locked ? (maintenance?.scope === 'both' ? 'WHOLE SITE' : maintenance?.scope === 'bio' ? 'BIO TOOL' : 'VIP HUB') : null;
  }

  // Announcement feed — loads regardless of gateway state, so its hooks sit before any early return.
  const [announcementOpen, setAnnouncementOpen] = useState<Announcement | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [historyTool, setHistoryTool] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnnouncements()
      .then((list) => {
        if (cancelled) return;
        setAnnouncements(list);
      })
      .catch(() => {
        /* cosmetic — fail silently */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stillConnecting = !liveStatusQuery.data && liveStatusQuery.isFetching;

  if (query.isLoading) return <QueryLoading label="OPENING PLAYER GATEWAY" />;
  if (query.isError || !gateway || !bioTool) return <QueryError onRetry={() => query.refetch()} />;

  async function handleRestore() {
    const key = restoreKey.trim();
    if (!key) {
      setRestoreError('Please paste your VIP key (RNS-XXXXX-XXXXXX).');
      setRestoreStatus(null);
      return;
    }
    setRestoreError('');
    setRestoreStatus('loading');
    try {
      const result = await vipRegister('', '', key);
      if (result.ok && result.memberKey) {
        window.localStorage.setItem('rns_vip_key', result.memberKey);
        window.localStorage.setItem('rbs_vip_status', result.status === 'vip' ? 'vip' : 'registered');
        setRestoreStatus('ok');
        window.setTimeout(() => {
          setRestoreOpen(false);
          setRestoreKey('');
          setRestoreStatus(null);
          window.location.href = '/vip';
        }, 1400);
      } else {
        setRestoreStatus('err');
        setRestoreError(result.error || 'This key could not be found. Check it and try again, or ask the admin for your key.');
      }
    } catch (err) {
      setRestoreStatus('err');
      setRestoreError('Network error. Please check your connection and try again.');
    }
  }

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
      {/* Scoped caution banner — sits directly above the Bio Tool card when Bio Tool (or whole site) is locked */}
      {maintenance?.enabled && (maintenance.scope === 'bio' || maintenance.scope === 'both') && maintenance.message ? (
        <CautionBanner
          message={maintenance.message}
          scopeLabel={maintenance.scope === 'both' ? 'whole network' : 'Bio Tool'}
          scheduledEnd={maintenance.scheduledEnd ?? null}
          isUpdate={isUpdateMode}
          compact
        />
      ) : null}
      <LockedCardWrap locked={bioLocked} scopeLabel={lockLabel(bioLocked)} isUpdate={isUpdateMode}>
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

      {/* Scoped caution banner — sits above the VIP Hub card when only VIP Hub is locked */}
      {maintenance?.enabled && maintenance.scope === 'vip' && maintenance.message ? (
        <CautionBanner
          message={maintenance.message}
          scopeLabel="VIP Hub"
          scheduledEnd={maintenance.scheduledEnd ?? null}
          isUpdate={isUpdateMode}
          compact
        />
      ) : null}

      <LockedCardWrap locked={vipLocked} scopeLabel={lockLabel(vipLocked)} isUpdate={isUpdateMode}>
        <article className="dashboard-feature-card dashboard-vip-card">
          <div className="dashboard-card-copy">
            <div className="dashboard-card-title-row"><h2>VIP Hub</h2><span className="dashboard-free-tag dashboard-free-tag-gold">VIP — MEMBERS ONLY</span></div>
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

      {/* Emergency key restore — directly below the VIP Hub dashboard card */}
      {/* (grid-column: 1/-1 spans under both cards) */}
      <div className="gateway-restore-row">
        {restoreOpen ? (
          <RestoreKeyPanel
            status={restoreStatus}
            error={restoreError}
            value={restoreKey}
            onChange={setRestoreKey}
            onClose={() => setRestoreOpen(false)}
            onConfirm={handleRestore}
          />
        ) : (
          <button type="button" onClick={() => setRestoreOpen(true)} className="gateway-restore-trigger" data-testid="button-emergency-key-restore">
            <span className="gateway-restore-label">In emergency, use your VIP key</span>
            <span className="gateway-restore-hint">Forgot your key or changed phone? Restore VIP access here.</span>
            <span aria-hidden="true" className="gateway-restore-arrow">→</span>
          </button>
        )}
      </div>
    </section>

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
          {liveTools.length === 0 ? <div className="py-5 text-xs text-muted-foreground">Checking partner tools…</div> : liveTools.map((tool) => <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="live-tool-item" data-testid={`dashboard-live-${tool.id}`}><span>{tool.name}</span><span data-history aria-label={`Show ${tool.name} status history`} className="inline-grid shrink-0 place-items-center border border-border bg-background/70 px-1.5 py-0.5 text-muted-foreground transition hover:border-accent/50 hover:text-accent" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setHistoryTool(tool.id); }}><History size={10} /></span><StatusPill status={tool.status} /></a>)}
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

      {/* Site announcements — real, admin-managed */}
      <article className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><div className="dashboard-section-label">From the owner</div><h2>Announcements</h2></div><div className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">{announcements.length} posts</div></div>
        <div className="space-y-2">
          {announcements.length === 0 ? (
            <div className="py-5 text-center text-xs text-muted-foreground">Nothing announced yet — official posts will appear here.</div>
          ) : (
            announcements.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAnnouncementOpen(item)}
                className="flex w-full items-start gap-2.5 border border-border bg-card/60 p-3 text-left transition hover:border-accent/50"
                data-testid={`button-announcement-${item.id}`}
              >
                <Bell size={12} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{item.title}</div>
                  {item.body ? <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{item.body}</div> : null}
                </div>
                <ChevronRight size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </article>
    </section>

    {announcementOpen ? <AnnouncementModal item={announcementOpen} onClose={() => setAnnouncementOpen(null)} /> : null}
    {historyTool ? <StatusHistoryModal toolId={historyTool} toolName={gateway?.tools.find((item: { id?: string; name?: string }) => item.id === historyTool)?.name ?? historyTool} onClose={() => setHistoryTool(null)} /> : null}
  </div>;
}

/** Announcement popup — mirrors the banner modal style so mobile feels familiar. */
function AnnouncementModal({ item, onClose }: { item: Announcement; onClose: () => void }) {
  const endsAt = item.ends_at
    ? (() => {
        const d = new Date(item.ends_at);
        return Number.isNaN(d.valueOf()) ? null : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      })()
    : null;
  return (
    <div className="banner-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" data-testid="announcement-popup">
      <div className="banner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-mono text-[10px] uppercase tracking-[.2em] text-accent">Announcement</div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close" data-testid="button-close-announcement">✕</button>
        </div>
        <h3 className="mt-2 text-base font-bold">{item.title}</h3>
        {item.body ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.body}</p> : null}
        {endsAt ? <div className="mt-3 text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Pinned until {endsAt}</div> : null}
        <button type="button" onClick={onClose} className="mt-4 self-end border border-accent/50 bg-accent/10 px-4 py-1.5 text-mono text-[9px] uppercase tracking-[.16em] text-accent hover:bg-accent/20" data-testid="button-close-announcement-ok">Got it</button>
      </div>
    </div>
  );
}

/** Live-status history popup — real probe history from the database (12 hours). */
function StatusHistoryModal({ toolId, toolName, onClose }: { toolId: string; toolName: string; onClose: () => void }) {
  const [points, setPoints] = useState<Array<{ ts: string; status: string; latencyMs: number | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStatusHistory(toolId, 12)
      .then((data) => {
        if (cancelled) return;
        setPoints(data.points ?? []);
      })
      .catch(() => {
        /* fail silently — cosmetic */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  return (
    <div className="banner-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" data-testid="status-history-popup">
      <div className="banner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-mono text-[10px] uppercase tracking-[.2em] text-accent">{toolName} / status history</div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close" data-testid="button-close-history">✕</button>
        </div>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={13} className="spin-slow" /> Pulling history…</div>
        ) : points.length === 0 ? (
          <p className="mt-4 text-xs leading-6 text-muted-foreground">No history recorded yet — probe data builds up as visitors use the site. Check back in a little while.</p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {points.slice(-24).reverse().map((point, index) => (
              <div key={index} className="flex items-center gap-2 border border-border bg-card/60 px-2.5 py-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${point.status === 'online' ? 'bg-emerald-400' : point.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} aria-hidden="true" />
                <span className="text-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{formatClock(point.ts)}</span>
                <span className="text-xs">{point.status}</span>
                {typeof point.latencyMs === 'number' ? <span className="ml-auto text-mono text-[9px] text-muted-foreground">{point.latencyMs} ms</span> : null}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground"><Activity size={11} /> Real probe records from the last 12 hours</div>
      </div>
    </div>
  );
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

/** Big caution banner (yellow/black sign style) shown when any dashboard is under maintenance.
 *  compact=true → sized like a single dashboard card (scoped maintenance, sits above the locked card).
 *  compact=false → spans both cards (whole-site maintenance, sits above the dashboard grid). */
function CautionBanner({ message, scopeLabel, scheduledEnd, isUpdate, compact }: { message: string; scopeLabel: string; scheduledEnd: string | null; isUpdate?: boolean; compact?: boolean }) {
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
      {isUpdate ? (
        /* LIVE UPDATE variant — big red megaphone ribbon, same size/placement rules as the caution banner */
        <div className={`caution-sign update-caution ${compact ? 'caution-sign-compact' : 'caution-sign-full'}`}>
          <div className="caution-head">
            <span className="caution-ribbon-strip">
              <Megaphone size={20} aria-hidden="true" /> LIVE UPDATE
            </span>
            <span className="caution-sub">Update is live</span>
          </div>
          <div className="caution-body">
            <div className="caution-title">
              <Megaphone size={16} aria-hidden="true" className="text-red-600" /> {scopeLabel} is getting a fresh upgrade
            </div>
            <p className="caution-message">{message || 'This dashboard is being upgraded and will be back shortly.'}</p>
            {endsAt ? (
              <div className="caution-time">
                <span className="caution-pulse" /> Back at {endsAt} — no action needed
              </div>
            ) : (
              <div className="caution-time">
                <span className="caution-pulse" /> We will bring it back as soon as it is ready
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CAUTION variant — yellow/black sign style (maintenance) */
        <div className={`caution-sign ${compact ? 'caution-sign-compact' : 'caution-sign-full'}`}>
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
      )}
    </div>
  );
}

/** Wraps a dashboard card: dims it and blocks pointer events when it is under maintenance. */
function LockedCardWrap({ locked, scopeLabel, children, isUpdate }: { locked: boolean; scopeLabel: string | null; children: React.ReactNode; isUpdate?: boolean }) {
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
          <span className="caution-pulse" /> {scopeLabel ?? 'LOCKED'} / {isUpdate ? 'UPDATE' : 'MAINTENANCE'}
        </div>
      ) : null}
    </div>
  );
}
