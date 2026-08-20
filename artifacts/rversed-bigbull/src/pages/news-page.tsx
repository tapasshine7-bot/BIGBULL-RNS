import { useEffect, useState } from 'react';
import { Newspaper, Flame, CalendarDays, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeading, QueryError, QueryLoading, EmptyState } from '@/components/page-kit';
import { getNews, type NewsItem } from '@/lib/ff-api';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  patch: { icon: <Flame size={12} />, label: 'Patch Notes', className: 'text-red-200 bg-red-500/15 border-red-400/50' },
  event: { icon: <CalendarDays size={12} />, label: 'Events', className: 'text-emerald-200 bg-emerald-500/15 border-emerald-400/50' },
  general: { icon: <Radio size={12} />, label: 'General', className: 'text-cyan-200 bg-cyan-500/15 border-cyan-400/50' },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.general;
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-mono text-[8px] uppercase tracking-[.18em] ${meta.className}`} data-testid={`news-category-${category}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNews()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <QueryLoading label="PULLING NEWS FEED" />;
  if (error) return <QueryError onRetry={() => window.location.reload()} label="News feed unavailable." />;
  if (items.length === 0) return <EmptyState title="No news yet" detail="The curated Free Fire feed is quiet right now — patch notes, events and announcements will appear here as soon as the owner posts them." />;

  return (
    <div className="route-in">
      <PageHeading
        eyebrow="Free Fire intel / curated feed"
        title="FF News."
        detail="Patch notes, live events and official announcements in one clean feed — curated so you never miss an update."
        action={<div className="text-mono border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">{items.length} stories</div>}
      />

      <div className="space-y-3">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <article key={item.id} className="border border-border bg-card/60 transition hover:border-primary/40" data-testid={`news-item-${item.id}`}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start gap-4 p-5 text-left"
                aria-expanded={open}
                data-testid={`button-news-${item.id}`}
              >
                <div className="mt-1 shrink-0">
                  <CategoryBadge category={item.category ?? 'general'} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-display text-lg font-bold uppercase tracking-wide">{item.title}</h2>
                  <time className="text-mono mt-1 block text-[9px] uppercase tracking-[.18em] text-muted-foreground">{formatDay(item.published_at)}</time>
                  {item.body && !open ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  ) : null}
                </div>
                {open ? <ChevronUp size={16} className="mt-1 shrink-0 text-muted-foreground" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-muted-foreground" />}
              </button>
              {open && item.body ? (
                <div className="border-t border-border px-5 py-4 text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{item.body}</div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 border border-border bg-card/50 p-4 text-xs leading-6 text-muted-foreground">
        <Newspaper size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>Stories are curated by the RNS BIGBULL team. Tap a story to expand the full note.</span>
      </div>
    </div>
  );
}
