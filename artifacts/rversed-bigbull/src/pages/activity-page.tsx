import { Activity, Clock3 } from 'lucide-react';
import { getGetActivityQueryKey, useGetActivity } from '@workspace/api-client-react';
import { EmptyState, PageHeading, QueryError, QueryLoading } from '@/components/page-kit';

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function ActivityPage() {
  const query = useGetActivity({ query: { queryKey: getGetActivityQueryKey() } });
  if (query.isLoading) return <QueryLoading label="LOADING ACTIVITY CHANNEL" />;
  if (query.isError || !query.data) return <QueryError onRetry={() => query.refetch()} label="Activity channel unavailable." />;

  return <div className="route-in">
    <PageHeading
      eyebrow="Player activity / session ledger"
      title="Activity."
      detail="A clean record of public system events from your RVRSED BIGBULL gateway."
      action={<div className="flex items-center gap-2 text-mono text-[10px] uppercase tracking-wider text-accent"><Activity size={14} /> {query.data.length} events</div>}
    />
    {query.data.length === 0 ? <EmptyState title="No activity yet" detail="System events will appear here as the network reports them." /> : <div className="activity-ledger">
      {query.data.map((item) => <div key={item.id} className="activity-ledger-row" data-testid={`activity-page-item-${item.id}`}>
        <div className="activity-ledger-icon"><Clock3 size={14} /></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><div className="text-sm font-semibold">{item.action}</div><div className="text-mono text-[9px] uppercase tracking-wider text-muted-foreground">{formatDateTime(item.createdAt)}</div></div><div className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</div></div>
      </div>)}
    </div>}
  </div>;
}