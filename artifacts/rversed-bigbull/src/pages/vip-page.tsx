import { ArrowUpRight, ExternalLink, Gift, Globe2 } from 'lucide-react';
import { getGetVipHubQueryKey, useGetVipHub } from '@workspace/api-client-react';
import { PageHeading, QueryError, QueryLoading, EmptyState } from '@/components/page-kit';
import { StatusPill } from '@/components/status-pill';

import { useEffect, useState } from 'react';
import { fetchBannerState } from '@/lib/admin';
import type { AdminMaintenance } from '@/lib/admin';

function MaintenanceScreen({ message, scheduledEnd }: { message: string; scheduledEnd: string | null }) {
  const endsAt = scheduledEnd
    ? (() => {
        const d = new Date(scheduledEnd);
        return Number.isNaN(d.valueOf())
          ? null
          : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      })()
    : null;
  return (
    <div className="route-in mx-auto grid min-h-[70vh] max-w-[560px] place-items-center text-center">
      <div className="border border-amber-300/50 bg-card/75 p-8">
        <div className="text-mono mb-3 text-[10px] uppercase tracking-[.2em] text-amber-300">Maintenance mode / VIP Hub</div>
        <h2 className="text-display text-xl font-bold uppercase tracking-wider">VIP Hub is temporarily offline</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{message || 'We are performing scheduled maintenance. It will be back shortly.'}</p>
        {endsAt ? (
          <p className="mt-3 text-mono text-[10px] uppercase tracking-[.16em] text-amber-300">Auto-reopens at {endsAt}</p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground/80">The Bio Tool and the rest of the network are working normally.</p>
        )}
      </div>
    </div>
  );
}

export function VipPage() {
  const query = useGetVipHub({ query: { queryKey: getGetVipHubQueryKey() } });
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);
  useEffect(() => {
    void fetchBannerState().then((state) => setMaintenance(state.maintenance));
  }, []);
  if (maintenance?.enabled && (maintenance.scope === 'both' || maintenance.scope === 'vip')) return <MaintenanceScreen message={maintenance.message} scheduledEnd={maintenance?.scheduledEnd ?? null} />;
  if (query.isLoading) return <QueryLoading label="LOADING VIP HUB NODES" />;
  if (query.isError || !query.data) return <QueryError onRetry={() => query.refetch()} label="VIP Hub unavailable." />;
  const tools = query.data.tools;
  return <div className="route-in"><PageHeading eyebrow="Free partner network / all nodes" title="VIP Hub." detail="Every partner tool, one clean launch surface. Check the live status, then open the tool in a new tab." action={<div className="text-mono border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">{tools.length} nodes available</div>} />
    {tools.length === 0 ? <EmptyState title="No partner nodes" detail="The network is quiet right now. Retry when the partner registry is back online." /> : <div className="grid gap-3 md:grid-cols-2">{tools.map((tool, index) => <article key={tool.id} className={`group relative overflow-hidden border border-border bg-card p-6 panel-edge transition hover:-translate-y-1 hover:border-primary/45 ${index === 0 ? 'md:row-span-2 md:p-8' : ''}`}><div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 border border-primary/10 transition group-hover:scale-125" /><div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center border border-border bg-secondary text-primary">{index === 0 ? <Globe2 size={19} /> : <Gift size={19} />}</div><StatusPill status={tool.status} /></div><div className="mt-8 flex-1"><div className="text-mono mb-2 text-[9px] uppercase tracking-[.2em] text-muted-foreground">Node {String(index + 1).padStart(2, '0')} / {tool.category}</div><h2 className="text-display text-3xl uppercase tracking-wider">{tool.name}</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{tool.description}</p></div><div className="mt-8 flex items-center justify-between border-t border-border pt-4"><div className="text-mono max-w-[190px] truncate text-[9px] text-muted-foreground">{tool.url}</div><a href={tool.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 active:translate-y-px" data-testid={`button-launch-${tool.id}`}><span>Launch</span><ArrowUpRight size={14} /></a></div></div></article>)}</div>}
    <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground"><ExternalLink size={14} className="text-accent" /> Partner tools open outside the gateway. The gateway remains available here.</div>
  </div>;
}