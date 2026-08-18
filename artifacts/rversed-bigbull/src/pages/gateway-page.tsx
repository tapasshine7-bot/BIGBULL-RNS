import { useMemo } from 'react';
import { Atom, BriefcaseBusiness, Check, Gift, Heart, Rocket, Smile, Trophy, UsersRound } from 'lucide-react';
import { getGetGatewayQueryKey, getGetLiveStatusQueryKey, useGetGateway, useGetLiveStatus } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { QueryError, QueryLoading } from '@/components/page-kit';
import { StatusPill } from '@/components/status-pill';

const toolIcons = [UsersRound, Smile, Heart, Rocket, BriefcaseBusiness, Trophy, Gift];

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
  const partnerTools = useMemo(() => gateway?.tools.filter((tool) => tool.id !== 'bio') ?? [], [gateway?.tools]);
  const liveTools = useMemo(
    () => liveStatusQuery.data?.statuses.filter((tool) => tool.id !== 'bio').slice(0, 4) ?? [],
    [liveStatusQuery.data?.statuses],
  );
  const onlineTools = liveStatusQuery.data?.statuses.filter((tool) => tool.status === 'online').length ?? 0;
  const isChecking = liveStatusQuery.isLoading || liveStatusQuery.isFetching;

  if (query.isLoading) return <QueryLoading label="OPENING PLAYER GATEWAY" />;
  if (query.isError || !gateway || !bioTool) return <QueryError onRetry={() => query.refetch()} />;

  return <div className="route-in dashboard-page">
    <header className="dashboard-topbar">
      <div>
        <div className="dashboard-kicker">Player control center</div>
        <h1 className="dashboard-welcome">Welcome to the <span>{gateway.user.displayName}</span></h1>
        <p className="dashboard-subtitle">Ready to dominate today?</p>
      </div>
      <div className="network-nominal"><span className="signal-pulse" /> {isChecking ? 'Checking network' : 'Live network status'}</div>
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

    <section className="dashboard-vip-tools">
      <div className="dashboard-panel-heading"><div><div className="dashboard-section-label">Free partner access</div><h2>VIP Hub tools</h2></div><Link href="/vip" className="dashboard-view-all">Open Hub →</Link></div>
      <div className="vip-tool-strip">
        {partnerTools.map((tool, index) => {
          const Icon = toolIcons[index % toolIcons.length];
          return <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="vip-tool-tile" data-testid={`dashboard-vip-${tool.id}`}><div className="vip-tool-icon"><Icon size={20} strokeWidth={1.6} /></div><div className="vip-tool-name">{tool.name}</div><div className="vip-tool-launch">Launch <span>→</span></div></a>;
        })}
      </div>
    </section>
  </div>;
}