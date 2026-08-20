import { useEffect, useState } from 'react';
import { Search, User, MapPin, Layers, RefreshCcw, Fingerprint, Sword, Heart, Crown, PawPrint, Users, MessageSquare, Shield, Calendar, Star } from 'lucide-react';
import { PageHeading, QueryLoading } from '@/components/page-kit';
import { BackButton } from '@/components/back-button';
import { lookupUid, lookupUidDeep, type DeepProfile } from '@/lib/ff-api';

export function UidPage() {
  const [uid, setUid] = useState('');
  const [result, setResult] = useState<{ name: string; level: number; region: string; source: string; uid: string } | null>(null);
  const [deep, setDeep] = useState<DeepProfile | null>(null);
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
    lookupUidDeep(value)
      .then(async (deepData) => {
        let final: DeepProfile | null = deepData;
        // Deep endpoint may still resolve via the seeded fallback (source=verified) — that's fine.
        if (!final?.name) {
          // Fallback to the simple lookup so the card still shows when the deep API is idle.
          const simple = await lookupUid(value);
          if (simple?.name) final = { uid: value, name: String(simple.name), region: simple.region ?? '', source: simple.source ?? 'cached', level: Number(simple.level ?? 0) };
        }
        if (final?.name) {
          setDeep(final);
          setResult({
            name: final.name,
            level: Number(final.level ?? 0),
            region: final.region ?? '',
            source: final.source ?? 'cached',
            uid: value,
          });
          try {
            window.localStorage.setItem('rns_last_uid', value);
          } catch {
            /* storage unavailable */
          }
        } else {
          setDeep(null);
          setResult(null);
          setError(deepData?.error || final?.error || 'Profile not found. Check the UID and try again.');
        }
      })
      .catch(() => {
        setDeep(null);
        setResult(null);
        setError('Network error — please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="route-in">
      <BackButton />
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
            {deep && deep.rank ? (
              <>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Sword size={11} /> BR Rank</div>
                  <div className="mt-2 text-display text-2xl font-bold">#{deep.rank}</div>
                  {deep.rankPoints ? <div className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">{deep.rankPoints} pts</div> : null}
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Heart size={11} /> Likes</div>
                  <div className="mt-2 text-display text-2xl font-bold">{deep.liked ?? '—'}</div>
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Crown size={11} /> Max Rank</div>
                  <div className="mt-2 text-display text-2xl font-bold">{deep.maxRank ? `#${deep.maxRank}` : '—'}</div>
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><PawPrint size={11} /> Pet</div>
                  <div className="mt-2 text-display text-2xl font-bold">{deep.petId ? `LV ${deep.petLevel ?? '?'}` : '—'}</div>
                  {deep.petSkinId ? <div className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">skin #{deep.petSkinId}</div> : null}
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Users size={11} /> Guild</div>
                  <div className="mt-2 text-display text-2xl font-bold">{deep.guildName || '—'}</div>
                  {deep.guildId ? <div className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">id {deep.guildId}</div> : null}
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><MessageSquare size={11} /> Signature</div>
                  <div className="mt-2 text-sm leading-5">{deep.signature || '—'}</div>
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Shield size={11} /> Account</div>
                  <div className="mt-2 text-sm">{deep.gender ? deep.gender.replace('Gender_', '').toLowerCase() : '—'}</div>
                  {deep.title ? <div className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">title #{deep.title}</div> : null}
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Calendar size={11} /> Last Login</div>
                  <div className="mt-2 text-sm">{deep.lastLoginAt ? new Date(Number(deep.lastLoginAt) * 1000).toLocaleDateString() : '—'}</div>
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-mono text-[8px] uppercase tracking-[.2em] text-muted-foreground"><Star size={11} /> Outfit</div>
                  <div className="mt-2 text-sm">{deep.clothes && deep.clothes.length ? `${deep.clothes.length} pieces` : '—'}</div>
                  {deep.clothes && deep.clothes.length ? <div className="text-mono text-[8px] uppercase tracking-[.16em] text-accent">ids {deep.clothes.slice(0, 3).join(', ')}…</div> : null}
                </div>
              </>
            ) : null}
          </div>
          {deep?.avatarUrl ? (
            <div className="mt-4 overflow-hidden border border-border bg-card">
              <img src={deep.avatarUrl} alt="Player banner" loading="lazy" className="block w-full" onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : null}
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
