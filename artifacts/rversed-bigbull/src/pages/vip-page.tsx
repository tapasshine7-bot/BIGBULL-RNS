import { ArrowUpRight, Briefcase, CheckCircle2, Copy, Crosshair, ExternalLink, Gift, Layers, LoaderCircle, LockKeyhole, Moon, Search, Smile, Sun, Swords, ThumbsUp, Wrench, X } from 'lucide-react';
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getGetVipHubQueryKey, useGetVipHub } from '@workspace/api-client-react';
import { PageHeading, QueryError, QueryLoading, EmptyState } from '@/components/page-kit';
import { BackButton } from '@/components/back-button';
import { StatusPill } from '@/components/status-pill';
import { fetchBannerState, vipPay, vipPayConfig, vipStatus, type AdminMaintenance, type VipPayConfig, type VipStatus } from '@/lib/admin';
import { getGuides, type GuideCard } from '@/lib/ff-api';

function useStoredMember(): { key: string | null; status: string | null } {
  const [entry, setEntry] = useState<{ key: string | null; status: string | null }>(() => {
    try {
      return {
        key: window.localStorage.getItem('rns_vip_key'),
        status: window.localStorage.getItem('rbs_vip_status'),
      };
    } catch {
      return { key: null, status: null };
    }
  });
  const refresh = () => {
    try {
      setEntry({
        key: window.localStorage.getItem('rns_vip_key'),
        status: window.localStorage.getItem('rbs_vip_status'),
      });
    } catch {
      setEntry({ key: null, status: null });
    }
  };
  return entry;
}

// ---------------------------------------------------------------------------
// VIP access gate + ₹20 UPI payment overlay
// ---------------------------------------------------------------------------
function VipGate({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { key: storedKey } = useStoredMember();
  const [config, setConfig] = useState<VipPayConfig | null>(null);
  const [liveStatus, setLiveStatus] = useState<VipStatus | null>(null);
  const [payState, setPayState] = useState<'idle' | 'loading' | 'paid' | 'done' | 'error'>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // No key at all → go back to the member page to register / recover.
    if (!storedKey) {
      navigate('/member');
      return;
    }
    // Load payment config in the background while checking VIP status.
    void vipPayConfig().then((cfg) => setConfig(cfg));
    void vipStatus(storedKey).then((result) => {
      if (!result.ok) return;
      // Blocked by admin → access revoked; clear local keys and force re-pay.
      if (result.status === 'blocked') {
        try {
          window.localStorage.removeItem('rns_vip_key');
          window.localStorage.removeItem('rbs_vip_status');
        } catch {
          /* ignore */
        }
        setLiveStatus('blocked');
        setPayMessage((result as { reason?: string }).reason ? `Blocked: ${result.reason}.` : 'Your VIP access was revoked.');
        navigate('/member');
        return;
      }
      setLiveStatus(result.status);
      try {
        window.localStorage.setItem('rbs_vip_status', result.status);
      } catch {
        /* ignore */
      }
      if (result.status === 'vip') setPayState('done');
    });
  }, [storedKey, navigate]);

  async function handlePaid() {
    if (payState === 'loading' || !storedKey) return;
    setPayState('loading');
    setPayMessage('');
    const result = await vipPay(storedKey);
    if (result.status === 'vip') {
      setLiveStatus('vip');
      setPayState('done');
      setPayMessage(result.message);
      return;
    }
    if (!result.ok) {
      setPayState('error');
      setPayMessage(result.message);
      return;
    }
    setPayState('paid');
    setPayMessage(result.message);
    // Poll status — approval is manual, so poll gently for 5 minutes.
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (attempts >= 10) {
        window.clearInterval(timer);
        return;
      }
      try {
        const next = await vipStatus(storedKey);
        if (next.ok && next.status === 'vip') {
          window.clearInterval(timer);
          setLiveStatus('vip');
          setPayState('done');
          setPayMessage('Payment approved — lifetime VIP access activated.');
          try {
            window.localStorage.setItem('rbs_vip_status', 'vip');
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* keep polling */
      }
    }, 30_000);
    void timer;
  }

  function copyUpi() {
    if (!config?.upiId) return;
    void navigator.clipboard?.writeText(config.upiId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  // Access granted — render the VIP Hub.
  if (liveStatus === 'vip' || payState === ('done' as 'idle')) return <>{children}</>;

  // Key present but not VIP — payment screen.
  return (
    <div className="route-in mx-auto grid min-h-[70vh] max-w-[560px] place-items-center px-4 text-center">
      <div className="border border-border bg-card p-8">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center border border-primary/30 bg-primary/10">
          <LockKeyhole size={20} className="text-primary" />
        </div>
        <div className="text-mono mb-3 text-[10px] uppercase tracking-[.2em] text-accent">VIP Hub / lifetime access</div>
        <h2 className="text-display text-xl font-bold uppercase tracking-wider">One-time unlock — ₹20</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Pay once, get lifetime VIP access. Send ₹20 to the UPI ID below, then tap <b>“I have paid”</b>. The admin approves manually — usually within a few minutes.
        </p>

        {payState !== 'done' && payState !== 'paid' && payState !== 'loading' ? (
          <div className="mt-5 space-y-3">
            {config?.upiId ? (
              <>
                <button type="button" onClick={copyUpi} className="vip-upi-box" data-testid="button-copy-upi">
                  <span className="break-all text-sm font-bold tracking-wider">{config.upiId}</span>
                  <span className="text-mono shrink-0 text-[9px] uppercase tracking-[.16em]">{copied ? '✓ Copied' : 'Copy UPI ID'}</span>
                </button>
                <div className="text-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                  Amount: ₹{config.amount} · {config.upiName}
                </div>
                {config.qrDataUrl ? (
                  <img src={config.qrDataUrl} alt="UPI QR code" className="mx-auto mt-3 h-40 w-40 border border-border bg-white p-2" data-testid="image-upi-qr" />
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle size={12} className="spin-slow" /> Loading payment details…
              </div>
            )}
          </div>
        ) : null}

        {payState === 'paid' ? (
          <div className="vip-paid-box" data-testid="vip-paid-notice" aria-live="polite">
            <LoaderCircle size={14} className="spin-slow" />
            <span>{payMessage || 'Payment submitted — waiting for admin approval. Check back in a few minutes.'}</span>
          </div>
        ) : null}
        {payState === 'loading' ? (
          <div className="vip-paid-box" data-testid="vip-loading-notice">
            <LoaderCircle size={14} className="spin-slow" /> Sending payment confirmation…
          </div>
        ) : null}
        {payState === 'error' ? (
          <div className="flex items-start gap-2 border border-red-300/40 bg-red-300/10 px-3 py-2 text-left text-[11px] text-red-300" role="alert">
            <X size={12} className="mt-0.5 shrink-0" /> <span>{payMessage || 'Could not send the payment confirmation. Please try again.'}</span>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          {payState === 'done' || payState === 'paid' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="dashboard-action dashboard-action-gold flex-1 justify-center"
              data-testid="button-vip-recheck"
            >
              <span>Check access again</span><span aria-hidden="true">→</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePaid}
                disabled={!config?.upiId || payState === 'loading'}
                className="dashboard-action dashboard-action-gold flex-1 justify-center disabled:opacity-60"
                data-testid="button-vip-i-have-paid"
              >
                <span>{payState === 'loading' ? 'Sending…' : 'I have paid'}</span><span aria-hidden="true">→</span>
              </button>
              <Link href="/member" className="dashboard-action dashboard-action-install">
                <span>Wrong key?</span>
              </Link>
            </>
          )}
        </div>

        {payState === 'done' ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[.16em] text-accent" data-testid="vip-unlocked-notice">
            <CheckCircle2 size={13} /> Lifetime VIP access activated
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
        <div className="text-mono mb-3 text-[10px] uppercase tracking-[.2em] text-amber-300">{isUpdate ? 'Update' : 'Maintenance'} mode / VIP Hub</div>
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
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('rns_dark_mode') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    void fetchBannerState().then((state) => setMaintenance(state.maintenance));
  }, []);

  useEffect(() => {
    if (dark) document.documentElement.classList.add('vip-dark-mode');
    else document.documentElement.classList.remove('vip-dark-mode');
    try {
      window.localStorage.setItem('rns_dark_mode', dark ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [dark]);

  if (maintenance?.enabled && (maintenance.scope === 'both' || maintenance.scope === 'vip')) return <MaintenanceScreen message={maintenance.message} scheduledEnd={maintenance?.scheduledEnd ?? null} isUpdate={maintenance.mode === 'update'} />;

  // VIP access gate (no key → /member; not VIP → payment screen).
  return (
    <VipGate>
      {query.isLoading ? <QueryLoading label="LOADING VIP HUB NODES" /> : query.isError || !query.data ? <QueryError onRetry={() => query.refetch()} label="VIP Hub unavailable." /> : <VipHubInner tools={query.data.tools.filter((tool) => tool.category !== 'bio')} search={search} setSearch={setSearch} dark={dark} setDark={setDark} />}
    </VipGate>
  );
}

// VIP Hub content: top-right bar (search + dark toggle) and the node grid.
function VipHubInner({
  tools,
  search,
  setSearch,
  dark,
  setDark,
}: {
  tools: Array<{ id: string; name: string; description: string; url: string; category: string; status: string; isFree?: boolean }>;
  search: string;
  setSearch: (value: string) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
}) {
  const filtered = useMemo(
    () => tools.filter((tool) => !search.trim() || tool.name.toLowerCase().includes(search.trim().toLowerCase())),
    [tools, search],
  );
  return (
    <div className="route-in">
      <BackButton />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PageHeading eyebrow="VIP partner network / all nodes" title="VIP Hub." detail="Every partner tool, one clean launch surface. Check the live status, then open the tool in a new tab." action={<div className="text-mono border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">{filtered.length} nodes available</div>} />
        <div className="relative w-full sm:w-auto">
          <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search tools…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-full rounded-sm border border-border bg-card pl-8 pr-3 text-xs outline-none transition focus:border-primary/50 sm:w-56"
            data-testid="input-vip-search"
          />
        </div>
        <button
          type="button"
          onClick={() => setDark(!dark)}
          aria-label="Toggle dark mode"
          className="grid h-8 w-8 shrink-0 place-items-center border border-border bg-card text-muted-foreground transition hover:text-foreground"
          data-testid="button-vip-dark-mode"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
      {tools.length === 0 ? <EmptyState title="No partner nodes" detail="The network is quiet right now. Retry when the partner registry is back online." /> : filtered.length === 0 ? <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">No tools match “{search.trim()}”.</div> : <div className="grid gap-4 md:grid-cols-2">{filtered.map((tool, index) => <PartnerCard key={tool.id} tool={tool} index={index} />)}</div>}
      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground"><ExternalLink size={14} className="text-accent" /> Partner tools open outside the gateway. The gateway remains available here.</div>

      <GuideCardsSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// "How to Use" guide cards — one per partner tool, real data from D1
// ---------------------------------------------------------------------------
function GuideCardsSection() {
  const [guides, setGuides] = useState<GuideCard[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGuides()
      .then((list) => {
        if (cancelled) return;
        setGuides(list);
      })
      .catch(() => {
        /* guides are cosmetic — fail silently */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (guides.length === 0) return null;

  return (
    <section className="mt-10" aria-label="How to use each tool">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen size={14} className="text-primary" />
        <h2 className="text-display text-2xl uppercase tracking-wider">How to use.</h2>
      </div>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">A quick run-through for every partner tool in the VIP Hub — open a guide, follow the steps, done.</p>
      <div className="space-y-2">
        {guides.map((guide) => {
          const open = openId === guide.tool_id;
          const steps = (guide.steps ?? []) as Array<string | { step?: string; text?: string }>;
          const tips = (guide.tips ?? []) as string[];
          const normalizedSteps = steps.map((entry) => (typeof entry === 'string' ? entry : (entry.text ?? entry.step ?? ''))).filter((text) => text.trim());
          return (
            <article key={guide.tool_id} className="border border-border bg-card/60 transition hover:border-primary/40" data-testid={`guide-${guide.tool_id}`}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : guide.tool_id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                aria-expanded={open}
                data-testid={`button-guide-${guide.tool_id}`}
              >
                <span className="min-w-0 flex-1 text-sm font-semibold">{guide.title}</span>
                {open ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
              </button>
              {open ? (
                <div className="border-t border-border px-4 py-4">
                  {normalizedSteps.length > 0 ? (
                    <ol className="space-y-2.5">
                      {normalizedSteps.map((text, index) => (
                        <li key={index} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                          <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-primary/50 bg-primary/10 text-[9px] font-bold text-primary">{index + 1}</span>
                          {text}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {tips.length > 0 ? (
                    <div className="mt-4 flex items-start gap-2 border border-border bg-background/50 p-3">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-300" />
                      <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                        {tips.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-accent" />{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <a href="/vip" className="mt-4 inline-flex items-center gap-1.5 text-mono text-[9px] uppercase tracking-[.18em] text-primary hover:underline" data-testid={`link-guide-launch-${guide.tool_id}`}>
                    Open {guide.title} <ArrowRight size={12} />
                  </a>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Rich partner tool card: brand icon, name badge, description, status and launch.
function PartnerCard({ tool, index }: { tool: { id: string; name: string; description: string; url: string; category: string; status: string; logoUrl?: string | null; isFree?: boolean }; index: number }) {
  const meta = TOOL_META[tool.id] ?? TOOL_META['default'];
  const Icon = meta.icon;
  return (
    <article className={`partner-card group relative overflow-hidden border border-border bg-card p-6 panel-edge transition hover:-translate-y-1 hover:border-primary/45 ${index === 0 ? 'md:row-span-2 md:p-8' : ''}`}>
      <div className={`partner-card-glow partner-glow-${meta.accent}`} aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className={`partner-icon partner-icon-${meta.accent}`}>
            {tool.logoUrl ? <img src={tool.logoUrl} alt="" className="h-7 w-7 rounded object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <Icon size={22} strokeWidth={1.6} />}
          </div>
          <StatusPill status={tool.status as 'online' | 'checking' | 'warning' | 'offline'} />
        </div>
        <div className="mt-7 flex-1">
          <div className="text-mono mb-2 text-[9px] uppercase tracking-[.2em] text-muted-foreground">Node {String(index + 1).padStart(2, '0')} / {tool.category}</div>
          <div className="flex items-center gap-2">
            <h2 className="text-display text-3xl uppercase tracking-wider">{tool.name}</h2>
            <span className={`partner-badge partner-badge-${meta.accent}`}>{meta.badge}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{tool.description}</p>
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <div className="text-mono max-w-[190px] truncate text-[9px] text-muted-foreground">{tool.url}</div>
          <a href={tool.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 active:translate-y-px partner-launch partner-launch-${meta.accent}`} data-testid={`button-launch-${tool.id}`}>
            <span>Launch</span><ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </article>
  );
}

const TOOL_META: Record<string, { icon: any; accent: string; badge: string }> = {
  'all-in-one': { icon: Layers, accent: 'gold', badge: 'ALL-IN-ONE' },
  'ff-bind': { icon: Crosshair, accent: 'blue', badge: 'BIND' },
  'ff-emote': { icon: Smile, accent: 'pink', badge: 'EMOTE' },
  'ff-likes': { icon: ThumbsUp, accent: 'green', badge: 'LIKES' },
  'gift': { icon: Gift, accent: 'purple', badge: 'GIFT' },
  'glory': { icon: Swords, accent: 'gold', badge: 'GLORY' },
  'reseller': { icon: Briefcase, accent: 'blue', badge: 'RESELLER' },
  'default': { icon: Wrench, accent: 'green', badge: 'TOOL' },
};
