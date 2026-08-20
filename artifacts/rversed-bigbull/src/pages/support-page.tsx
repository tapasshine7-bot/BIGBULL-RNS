import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { fetchBannerState } from '@/lib/admin';
import type { AdminMaintenance } from '@/lib/admin';

const INSTAGRAM_URL = 'https://www.instagram.com/justapas_/';
const INSTAGRAM_HANDLE = '@justapas_';

export function SupportPage() {
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBannerState().then((state) => {
      if (cancelled) return;
      setMaintenance(state.maintenance);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const scope = maintenance?.scope ?? '';
  const showGate = scope === 'both' || scope === 'vip';

  return (
    <div className="route-in dashboard-page max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-mono text-[9px] uppercase tracking-[.28em] text-muted-foreground">Helpdesk</div>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reach the RVRSED BIGBULL team directly.</p>
        </div>
        <span className="border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-mono text-[9px] uppercase tracking-[.18em] text-accent">24×7 helpdesk</span>
      </div>

      {/* VIP access gate for maintenance */}
      {showGate && <AccessGate scope={scope} />}

      {/* Primary contact: Instagram */}
      <section aria-label="Instagram contact">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-instagram"
          className="group block border border-transparent transition hover:border-primary/30"
        >
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 transition group-hover:border-primary/30">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] opacity-15 blur-2xl transition group-hover:opacity-30" />
            <div className="relative flex items-center gap-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] shadow-lg shadow-fuchsia-900/30">
                <InstagramLogo />
              </div>
              <div className="min-w-0">
                <div className="text-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">Official Instagram</div>
                <div className="mt-0.5 truncate text-xl font-bold tracking-tight">{INSTAGRAM_HANDLE}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Fastest way to reach us — DM us there for VIP keys, payment proof, or any issue.</p>
              </div>
            </div>
            <div className="relative mt-5 flex items-center justify-center border border-primary/35 bg-primary/10 px-4 py-2.5 text-mono text-[10px] uppercase tracking-[.18em] text-primary transition group-hover:bg-primary/20">
              Open Instagram &nbsp;→
            </div>
          </div>
        </a>
      </section>

      {/* Guidelines */}
      <section className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Support guidelines">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-mono text-[9px] uppercase tracking-[.22em] text-accent">VIP keys</div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">Lost your key? Send us your name on Instagram — we will find it in our records and hand it back to you.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-mono text-[9px] uppercase tracking-[.22em] text-accent">Payments</div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">Paid ₹20 but VIP not unlocked? Share your payment screenshot with us — approval usually takes a few minutes.</p>
        </div>
      </section>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">RVRSED BIGBULL · helpdesk · no login required · lifetime VIP keys</p>
    </div>
  );
}

function AccessGate({ scope }: { scope: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 border border-destructive/40 bg-destructive/10 px-4 py-3">
      <LoaderCircle size={15} className="spin-slow text-destructive" />
      <span className="text-mono text-[10px] uppercase tracking-[.14em] text-destructive">
        {scope === 'both' ? 'Everything is in maintenance — support channel open.' : 'VIP Hub is under maintenance — support channel open.'}
      </span>
    </div>
  );
}

/** Instagram glyph — drawn with SVG paths so no external asset is needed. */
function InstagramLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.6" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="16.8" cy="7.2" r="1.05" fill="#ffffff" />
    </svg>
  );
}
