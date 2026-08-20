import { useState } from 'react';
import { Crosshair, TrendingUp, Trophy } from 'lucide-react';
import { PageHeading, QueryError, QueryLoading } from '@/components/page-kit';
import { computeHeadshot } from '@/lib/ff-api';

const TIER_COLORS: Record<string, string> = {
  Rookie: 'border-gray-400/50 text-gray-200 bg-gray-500/15',
  Casual: 'border-green-400/50 text-green-200 bg-green-500/15',
  Competitive: 'border-emerald-400/50 text-emerald-200 bg-emerald-500/15',
  Pro: 'border-cyan-400/50 text-cyan-200 bg-cyan-500/15',
  Elite: 'border-blue-400/50 text-blue-200 bg-blue-500/15',
  Legend: 'border-amber-400/50 text-amber-200 bg-amber-500/15',
  Unranked: 'border-border text-muted-foreground bg-card/60',
};

export function HeadshotPage() {
  const [kd, setKd] = useState('');
  const [matches, setMatches] = useState('');
  const [result, setResult] = useState<{ headshotRatio: number; tier: string; tip: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorText, setErrorText] = useState('');

  function handleCompute() {
    const kdNum = parseFloat(kd);
    const matchesNum = parseInt(matches || '0', 10);
    if (isNaN(kdNum) || kdNum < 0 || kdNum > 50 || isNaN(matchesNum) || matchesNum < 0 || matchesNum > 50000) {
      setErrorText('Enter a valid KD ratio (0–50) and match count (0–50,000).');
      setError(true);
      setResult(null);
      return;
    }
    setError(false);
    setErrorText('');
    setLoading(true);
    computeHeadshot(kdNum, matchesNum)
      .then((data) => {
        if (typeof data.headshotRatio === 'number') {
          setResult({ headshotRatio: data.headshotRatio, tier: data.tier ?? 'Unranked', tip: data.tip ?? '' });
        } else {
          setError(true);
          setErrorText('Could not compute. Please check your inputs and try again.');
        }
      })
      .catch(() => {
        setError(true);
        setErrorText('Network error — please check your connection.');
      })
      .finally(() => setLoading(false));
  }

  const ringDash = 2 * Math.PI * 52;
  const ringOffset = ringDash * (1 - (result?.headshotRatio ?? 0) / 100);

  return (
    <div className="route-in">
      <PageHeading
        eyebrow="Free Fire utility / skill meter"
        title="Headshot % Calculator."
        detail="Enter your KD ratio and matches played to estimate your headshot percentage, see your skill tier and get a personalized tip."
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="border border-border bg-card/60 p-5">
          <div className="text-mono mb-4 text-[9px] uppercase tracking-[.22em] text-muted-foreground">Your stats</div>
          <label className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">KD ratio</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Example: 3.5"
            value={kd}
            onChange={(event) => setKd(event.target.value)}
            className="mt-1.5 w-full border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            data-testid="input-kd"
          />
          <label className="mt-4 block text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Matches played</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Example: 1200"
            value={matches}
            onChange={(event) => setMatches(event.target.value)}
            className="mt-1.5 w-full border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            data-testid="input-matches"
          />
          {error ? <div className="mt-3 text-[11px] leading-4 text-red-400" data-testid="text-headshot-error">{errorText}</div> : null}
          <button
            type="button"
            onClick={handleCompute}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-primary px-4 py-3 text-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground transition hover:bg-primary/90 active:translate-y-px disabled:opacity-50"
            data-testid="button-compute-headshot"
          >
            {loading ? <><TrendingUp size={12} className="spin-slow" /> Calculating…</> : <><Crosshair size={13} /> Calculate headshot %</>}
          </button>
          <p className="mt-4 text-mono text-[8px] uppercase tracking-[.16em] leading-5 text-muted-foreground">Estimate is a heuristic, not a guaranteed number. Real headshot % is tracked inside Free Fire's own stats.</p>
        </div>

        <div className="border border-border bg-card/60 p-5">
          <div className="text-mono mb-4 text-[9px] uppercase tracking-[.22em] text-muted-foreground">Result</div>
          {result ? (
            <div className="flex flex-col items-center text-center">
              <div className="relative grid h-40 w-40 place-items-center">
                <svg width="150" height="150" viewBox="0 0 120 120" aria-label={`Headshot estimate ${result.headshotRatio}%`}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(22 28 38)" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="url(#hs-gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringDash}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 60 60)"
                  />
                  <defs>
                    <linearGradient id="hs-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgb(34 211 238)" />
                      <stop offset="100%" stopColor="rgb(16 185 129)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div>
                    <div className="text-display text-4xl font-bold">{result.headshotRatio.toFixed(1)}%</div>
                    <div className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">estimated headshot</div>
                  </div>
                </div>
              </div>
              <div className={`mt-6 border px-4 py-2 ${TIER_COLORS[result.tier] ?? TIER_COLORS.Unranked}`}>
                <span className="text-mono text-[10px] uppercase tracking-[.22em]">
                  <Trophy size={12} className="mr-1.5 inline-block align-middle" /> Tier: {result.tier}
                </span>
              </div>
              {result.tip ? (
                <div className="mt-5 max-w-md border border-border bg-background/50 p-4 text-left text-sm leading-6 text-muted-foreground">
                  <div className="text-mono mb-1.5 text-[9px] uppercase tracking-[.22em] text-accent">Coach tip</div>
                  {result.tip}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid h-64 place-items-center border border-dashed border-border text-center text-sm text-muted-foreground">
              <div>
                <Crosshair size={22} className="mx-auto opacity-60" />
                <div className="mt-3">Set your stats and tap calculate to reveal your estimate.</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
