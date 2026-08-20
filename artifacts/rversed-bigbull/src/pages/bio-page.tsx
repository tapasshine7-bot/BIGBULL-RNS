import { ArrowUpRight, Code2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getGetBioToolQueryKey, useGetBioTool } from '@workspace/api-client-react';
import { PageHeading, QueryError, QueryLoading } from '@/components/page-kit';
import { StatusPill } from '@/components/status-pill';

import { fetchBannerState } from '@/lib/admin';
import type { AdminMaintenance } from '@/lib/admin';
import { getBioTemplates, type BioTemplate } from '@/lib/ff-api';

const TEMPLATE_CATEGORIES = ['all', 'gamer', 'attitude', 'sad', 'love'] as const;
const CATEGORY_LABELS: Record<string, string> = { all: 'All', gamer: 'Gamer', attitude: 'Attitude', sad: 'Sad', love: 'Love' };

function MaintenanceScreen({ message, scheduledEnd, isUpdate }: { message: string; scheduledEnd: string | null; isUpdate?: boolean }) {
  const endsAt = scheduledEnd
    ? (() => {
        const d = new Date(scheduledEnd);
        return Number.isNaN(d.valueOf())
          ? null
          : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      })()
    : null;
  return (
    <div className="route-in mx-auto grid min-h-[70vh] max-w-[560px] place-items-center text-center">
      <div className="border border-amber-300/50 bg-card/75 p-8">
        <div className="text-mono mb-3 text-[10px] uppercase tracking-[.2em] text-amber-300">{isUpdate ? 'Update' : 'Maintenance'} mode / Bio Tool</div>
        <h2 className="text-display text-xl font-bold uppercase tracking-wider">Bio Tool is temporarily offline</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{message || 'We are performing scheduled maintenance. It will be back shortly.'}</p>
        {endsAt ? (
          <p className="mt-3 text-mono text-[10px] uppercase tracking-[.16em] text-amber-300">Auto-reopens at {endsAt}</p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground/80">The VIP Hub and the rest of the network are working normally.</p>
        )}
      </div>
    </div>
  );
}

export function BioPage() {
  const query = useGetBioTool({ query: { queryKey: getGetBioToolQueryKey() } });
  const [copied, setCopied] = useState(false);
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);
  useEffect(() => {
    void fetchBannerState().then((state) => setMaintenance(state.maintenance));
  }, []);
  if (maintenance?.enabled && (maintenance.scope === 'both' || maintenance.scope === 'bio')) return <MaintenanceScreen message={maintenance.message} scheduledEnd={maintenance?.scheduledEnd ?? null} isUpdate={maintenance.mode === 'update'} />;
  if (query.isLoading) return <QueryLoading label="CHECKING BIO TOOL NODE" />;
  if (query.isError || !query.data) return <QueryError onRetry={() => query.refetch()} label="Bio Tool unavailable." />;
  const tool = query.data;
  const copyUrl = async () => { await navigator.clipboard?.writeText(tool.url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="route-in"><PageHeading eyebrow="Featured partner / profile utility" title="Bio Tool." detail="A direct launch surface for the free Bio Tool. Check its live channel before you go." action={<StatusPill status={tool.status} />} />
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="relative overflow-hidden border border-primary/30 bg-primary/5 p-7 sm:p-10"><div className="absolute right-8 top-8 h-24 w-24 border border-primary/20" /><div className="absolute right-14 top-14 h-12 w-12 border border-accent/30" /><Code2 size={25} className="relative text-primary" /><div className="text-mono relative mt-16 text-[10px] uppercase tracking-[.25em] text-primary">Free partner access / ready</div><h2 className="text-display relative mt-3 text-5xl uppercase leading-[.9] tracking-wider sm:text-7xl">{tool.name}</h2><p className="relative mt-6 max-w-lg text-sm leading-7 text-muted-foreground">{tool.description}</p><a href={tool.url} target="_blank" rel="noreferrer" className="relative mt-9 inline-flex items-center gap-3 bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:translate-y-px" data-testid="button-launch-bio"><span>Launch Bio Tool</span><ArrowUpRight size={17} /></a></section><aside className="border border-border bg-card p-6"><div className="text-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Node diagnostics</div><div className="mt-6 space-y-5"><div><div className="mb-2 text-xs text-muted-foreground">Live status</div><StatusPill status={tool.status} /></div><div><div className="mb-2 text-xs text-muted-foreground">Category</div><div className="text-sm">{tool.category}</div></div><div><div className="mb-2 text-xs text-muted-foreground">Endpoint</div><div className="flex items-center gap-2 border border-border bg-background p-3"><span className="text-mono min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{tool.url}</span><button onClick={copyUrl} aria-label="Copy Bio Tool endpoint" className="text-muted-foreground transition hover:text-primary" data-testid="button-copy-bio-url"><Copy size={14} /></button></div>{copied && <div className="mt-2 text-xs text-accent">Endpoint copied.</div>}</div></div><div className="mt-10 border-t border-border pt-5"><div className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" /> Your gateway stays open while the partner tool runs in a separate tab.</div></div></aside></div>    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ExternalLink size={14} className="text-primary" /> This is a free partner tool. No payment or lock screen is involved.</div>

    <TemplatesGallery />
  </div>;
}

/** Templates gallery inside Bio Tool: category tabs + one-tap copy cards (real D1 data). */
function TemplatesGallery() {
  const [templates, setTemplates] = useState<BioTemplate[]>([]);
  const [category, setCategory] = useState<(typeof TEMPLATE_CATEGORIES)[number]>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getBioTemplates()
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        setBusy(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = templates.filter((template) => category === 'all' || template.category === category);

  async function copyTemplate(template: BioTemplate) {
    try {
      await navigator.clipboard?.writeText(template.template_text);
    } catch {
      return;
    }
    setCopiedId(template.id);
    window.setTimeout(() => setCopiedId((current) => (current === template.id ? null : current)), 1600);
  }

  return (
    <section className="mt-8" aria-label="Bio templates">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-mono text-[9px] uppercase tracking-[.22em] text-primary">Bonus / one-tap bios</div>
          <h2 className="text-display text-3xl uppercase tracking-wider">Template gallery.</h2>
        </div>
        <div className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">{templates.length} templates</div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={`border px-2.5 py-1.5 text-mono text-[9px] uppercase tracking-[.16em] transition ${
              category === option ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
            data-testid={`chip-template-${option}`}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>
      {busy ? (
        <QueryLoading label="LOADING TEMPLATE COLLECTION" />
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">No templates in “{CATEGORY_LABELS[category]}” yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((template) => (
            <article key={template.id} className="group border border-border bg-card p-4 transition hover:border-primary/40">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground">{CATEGORY_LABELS[template.category] ?? template.category}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold">{template.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyTemplate(template)}
                  aria-label={`Copy ${template.title}`}
                  className="grid h-8 w-8 shrink-0 place-items-center border border-border bg-background text-muted-foreground transition group-hover:border-primary/50 group-hover:text-primary"
                  data-testid={`button-copy-template-${template.id}`}
                >
                  <Copy size={13} />
                </button>
              </div>
              <p className="mt-3 break-words text-xs leading-6 text-muted-foreground" data-testid={`text-template-${template.id}`}>{template.template_text}</p>
              {copiedId === template.id ? <div className="mt-2 text-mono text-[9px] uppercase tracking-[.18em] text-accent">Copied — paste it in your bio</div> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}