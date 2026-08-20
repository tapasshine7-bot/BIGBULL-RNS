import { useEffect, useState } from 'react';
import { Search, User, MapPin, Layers, RefreshCcw, Fingerprint } from 'lucide-react';
import { PageHeading, QueryLoading } from '@/components/page-kit';
import { lookupUid } from '@/lib/ff-api';

export function UidPage() {
  const [uid, setUid] = useState('');
  const [result, setResult] = useState<{ name: string; level: number; region: string; source: string; uid: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('rns_last_uid');
    if (stored) setUid(stored);
  }, []);

  function handleLookup() {
    const value = uid.trim();
    if (!/^\d{7,12}$/.test(value)) {
      setError('Enter a valid Free Fire UID — 7 to 12 digits, numbers only.');
      setResult(null);
      setHasSearched(false);
      return;
    }
    setError(null);
    setLoading(true);
    setHasSearched(true);
    lookupUid(value)
      .then((data) => {
        if (data?.name) {
          setResult({
            name: data.name as string,
            level: Number(data.level ?? 0),
            region: data.region ?? '',
            source: data.source ?? 'cached',
            uid: value,
          });
          try {
            window.localStorage.setItem('rns_last_uid', value);
          } catch {
            /* storage unavailable */
          }
        } else {
          setResult(null);
          setError(data?.error || 'Profile not found. Check the UID and try again.');
        }
      })
      .catch(() => {
        setResult(null);
        setError('Network error — please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="route-in">
      <PageHeading
        eyebrow="Free Fire utility / profile lookup"
        title="UID Lookup."
        detail="Search any Free Fire player by UID to see their in-game name, level and region — pulled from the public player API with our own fallback cache."
      />

      <section className="border border-border bg-card/60 p-5">
        <label className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">Free Fire UID</label>
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="off"
            placeholder="Example: 2397164279"
            value={uid}
            onChange={(event) => setUid(event.target.value.replace(/[^\d]/g, '').slice(0, 12))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleLookup();
            }}
            className="mt-0 flex-1 border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            data-testid="input-uid"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground transition hover:bg-primary/90 active:translate-y-px disabled:opacity-50"
            data-testid="button-uid-lookup"
          >
            {loading ? <RefreshCcw size={13} className="spin-slow" /> : <Search size={13} />} {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error ? <div className="mt-3 text-[11px] leading-4 text-red-400" data-testid="text-uid-error">{error}</div> : null}
      </section>

      {hasSearched && loading ? (
        <QueryLoading label="SEARCHING PUBLIC PROFILE API" />
      ) : result ? (
        <section className="mt-5 border border-primary/30 bg-primary/5 p-6" aria-label="Profile result">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center border border-primary/40 bg-primary/15 text-display text-2xl text-primary" aria-hidden="true">
                {result.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-mono text-[8px] uppercase tracking-[.2em] text-primary">Found / player profile</div>
                  {result.source === 'verified' ? (
                    <span className="border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-mono text-[8px] uppercase tracking-[.16em] text-emerald-400">✓ Verified profile</span>
                  ) : null}
                </div>
                <h2 className="text-display text-3xl uppercase tracking-wider">{result.name}</h2>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><User size={11} /> Level</div>
              <div className="mt-2 text-display text-2xl font-bold">{result.level || '—'}</div>
            </div>
            <div className="border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><MapPin size={11} /> Region</div>
              <div className="mt-2 text-display text-2xl font-bold uppercase">{result.region || '—'}</div>
            </div>
            <div className="border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Fingerprint size={11} /> UID</div>
              <div className="mt-2 text-display text-2xl font-bold">{result.uid}</div>
            </div>
          </div>
          <div className="mt-4 text-mono text-[8px] uppercase tracking-[.18em] text-muted-foreground">
            Source: {result.source === 'live' ? 'live public API' : result.source === 'verified' ? 'verified admin profile — always available' : 'our cached record'} — levels update as the player keeps playing
          </div>
        </section>
      ) : hasSearched && !loading ? (
        <section className="mt-5 border border-dashed border-border bg-card/40 p-8 text-center">
          <div className="text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">No signal / profile not found</div>
          <div className="mt-3 text-display text-3xl uppercase tracking-wider">Player not found</div>
          <p className="mt-2 max-w-md mx-auto text-sm leading-6 text-muted-foreground">We could not find a profile for that UID. Double-check the number — if the player never made their profile public, some UIDs cannot be looked up.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Layers size={13} className="text-accent" /> The search uses the public Free Fire profile API, so private profiles stay private.</div>
        </section>
      ) : (
        <section className="mt-5 flex items-start gap-3 border border-border bg-card/50 p-4 text-xs leading-6 text-muted-foreground">
          <Search size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>Tip: find your own UID inside Free Fire — open your profile, tap the copy button under your name, and paste it here. Your last searched UID is remembered on this device.</span>
        </section>
      )}
    </div>
  );
}
