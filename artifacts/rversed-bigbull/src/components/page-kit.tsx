import { AlertTriangle, ChevronRight, LoaderCircle, RefreshCcw } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end"><div><div className="text-mono mb-3 text-[10px] uppercase tracking-[.22em] text-primary">{eyebrow}</div><h1 className="text-display text-5xl font-bold uppercase leading-none tracking-wider text-foreground sm:text-6xl">{title}</h1>{detail && <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

export function QueryLoading({ label = 'SYNCING NETWORK DATA' }: { label?: string }) {
  return <div className="space-y-3" aria-label={label} data-testid="state-loading">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse border border-border bg-card/70" />)}<div className="flex items-center gap-2 pt-2 text-mono text-[10px] tracking-[.2em] text-muted-foreground"><LoaderCircle size={13} className="spin-slow" /> {label}</div></div>;
}

export function QueryError({ onRetry, label = 'Network sync failed.' }: { onRetry: () => void; label?: string }) {
  return <div className="border border-destructive/30 bg-destructive/10 p-7" data-testid="state-error"><AlertTriangle className="mb-4 text-red-300" size={22} /><div className="text-display text-2xl uppercase tracking-wide">{label}</div><p className="mt-2 text-sm text-muted-foreground">The gateway could not reach the live data channel.</p><button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 border border-destructive/40 px-3 py-2 text-xs text-red-200 transition hover:bg-destructive/10" data-testid="button-retry"><RefreshCcw size={14} /> Retry sync</button></div>;
}

export function EmptyState({ title, detail, href, label }: { title: string; detail: string; href?: string; label?: string }) {
  return <div className="border border-dashed border-border bg-card/40 p-8" data-testid="state-empty"><div className="text-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">No signal / empty channel</div><div className="mt-3 text-display text-3xl uppercase tracking-wider">{title}</div><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>{href && <a href={href} className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:underline" data-testid="link-empty-action">{label ?? 'Open channel'} <ChevronRight size={14} /></a>}</div>;
}