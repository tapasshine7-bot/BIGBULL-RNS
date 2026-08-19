import { useMemo } from 'react';
import { Atom, Check, Download, LoaderCircle, Smartphone } from 'lucide-react';
import { useInstallPrompt, useIsStandalone } from '@/hooks/use-install-prompt';
import { getGetGatewayQueryKey, getGetLiveStatusQueryKey, useGetGateway, useGetLiveStatus } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { useSession } from '@/hooks/use-session';
import { QueryError, QueryLoading } from '@/components/page-kit';
import { StatusPill } from '@/components/status-pill';


function formatClock(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function GatewayPage() {
  const [, setLocation] = useLocation();
  const { logout } = useSession();
  const query = useGetGateway({ query: { queryKey: getGetGatewayQueryKey() } });

  // If the API ever rejects the saved session (e.g., stale token), sign the
  // player out and send them back to login instead of a stuck error screen.
  if (
    query.isError &&
    query.error &&
    typeof query.error === 'object' &&
    'status' in query.error &&
    query.error.status === 401
  ) {
    void logout().then(() => setLocation('/login'));
  }
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

  if (query.isLoading) return <QueryLoading label="OPENING PLAYER GATEWAY" />; // install hooks must come before early returns
  if (query.isError || !gateway || !bioTool) return <QueryError onRetry={() => query.refetch()} />;

  const stillConnecting = !liveStatusQuery.data && liveStatusQuery.isFetching;

  return <div className="route-in dashboard-page">
    <header className="dashboard-topbar">
      <div>
        <div className="dashboard-kicker">Player control center</div>
        <h1 className="dashboard-welcome">Welcome to the <span>{gateway.user.displayName}</span></h1>
        <p className="dashboard-subtitle">Ready to dominate today?</p>
      </div>
      <div className="network-nominal"><span className="signal-pulse" /> {stillConnecting ? <span className="inline-flex items-center gap-1.5"><LoaderCircle size={12} className="spin-slow" /> Connecting to gateway…</span> : isChecking ? 'Checking network' : 'Live network status'}</div>
    </header>

    <section className="dashboard-feature-grid" aria-label="Primary dashboards">
      <article className="dashboard-feature-card dashboard-bio-card">
        <div className="dashboard-card-copy">
          <div className="dashboard-card-title-row"><h2>Bio Tool</h2><span className="dashboard-free-tag">FREE</span></div>
          <p>Powerful bio generator and customization tool.</p>
          <a href={bioTool.url} target="_blank" rel="noreferrer" className="dashboard-action dashboard-action-purple" data-testid="button-dashboard-bio"><span>Launch Bio Tool</span><span aria-hidden="true">→</span></a>
        </div>
        <div className="dashboard-card-art dashboard-bio-art" aria-hidden="true"><Atom size={92} strokeWidth={1} /></div>
      </article>
      <article className="dashboard-feature-card dashboard-vip-card">
        <div className="dashboard-card-copy">
          <div className="dashboard-card-title-row"><h2>VIP Hub</h2><span className="dashboard-free-tag dashboard-free-tag-green">FREE ACCESS</span></div>
          <p>All partner tools in one place.<br className="hidden sm:block" /> Fast. Safe. Always Online.</p>
          <Link href="/vip" className="dashboard-action dashboard-action-gold" data-testid="button-dashboard-vip"><span>Open VIP Hub</span><span aria-hidden="true">→</span></Link>
        </div>
        <div className="dashboard-card-art dashboard-vip-art" aria-hidden="true"><span>♛</span></div>
      </article>
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
          {liveTools.length === 0 ? <div className="py-5 text-xs text-muted-foreground">Checking partner tools…</div> : liveTools.map((tool) => <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="live-tool-item" data-testid={`dashboard-live-${tool.id}`}><span>{tool.name}</span><StatusPill status={tool.status} /></a>)}
        </div>
        <div className="dashboard-panel-footer"><Check size={13} /> {liveStatusQuery.data ? `Checked ${formatClock(liveStatusQuery.data.checkedAt)}` : 'Checking live availability'}</div>
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