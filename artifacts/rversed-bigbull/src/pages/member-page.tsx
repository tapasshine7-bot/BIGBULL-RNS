// VIP membership page — first visit name entry + unique lifetime key, and
// key re-entry for returning visitors who cleared their browser data.
// This page has NO app shell (terminal/sidebar/topbar) — it is a clean gate.

import { Copy, KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { vipRegister, type VipStatus } from '@/lib/admin';

export function MemberPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'register' | 'recover'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [recoverKey, setRecoverKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [vipStatus, setVipStatus] = useState<VipStatus | null>(null);

  function saveKey(key: string, status: VipStatus) {
    try {
      window.localStorage.setItem('rns_vip_key', key);
      window.localStorage.setItem('rbs_vip_status', status || 'registered');
    } catch {
      /* storage unavailable — user can still continue */
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter your name to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await vipRegister(cleanName, email.trim());
      if (!result.ok || !result.memberKey) {
        setError(result.error || 'Could not create your unique key. Please try again.');
        return;
      }
      setMemberKey(result.memberKey);
      setVipStatus(result.status);
      saveKey(result.memberKey, result.status);
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRecover(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const cleanKey = recoverKey.trim().toUpperCase();
    if (!cleanKey) {
      setError('Please enter your unique key (format: RNS-XXXXX-XXXXXX).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await vipRegister('', '', cleanKey);
      if (!result.ok || !result.memberKey) {
        setError(result.error || 'This key was never registered. Check the spelling or create a new name.');
        return;
      }
      setMemberKey(result.memberKey);
      setVipStatus(result.status);
      saveKey(result.memberKey, result.status);
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function copyKey() {
    if (!memberKey) return;
    void navigator.clipboard?.writeText(memberKey);
  }

  // ------- Key shown: big copy confirmation --------------------------------
  if (memberKey) {
    const isVip = vipStatus === 'vip';
    return (
      <div className="route-in member-page min-h-dvh bg-background px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-md">
          <div className="border border-border bg-card px-5 py-6">
            <div className="member-head">
              <span className="signal-pulse" />
              <h1 className="text-display text-xl font-bold uppercase tracking-tight">Your unique key</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isVip
                ? 'Lifetime VIP access confirmed. Keep this key safe — it works on any device.'
                : 'Save this key — it is your lifetime VIP pass. If you ever lose it, you can re-enter it from this page.'}
            </p>
            <div className="member-key-box">
              <code className="break-all text-base font-bold tracking-wider text-accent">{memberKey}</code>
              <button type="button" onClick={copyKey} className="member-copy-btn" data-testid="button-copy-member-key">
                <Copy size={13} /> Copy
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[.14em] text-muted-foreground">
              <ShieldCheck size={13} className="text-accent" />
              <span>One-time entry · {isVip ? 'VIP — lifetime access' : '₹20 unlock inside VIP Hub'}</span>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/gateway')}
                className="dashboard-action dashboard-action-gold flex-1 justify-center"
                data-testid="button-continue-gateway"
              >
                <span>Continue to dashboard</span><span aria-hidden="true">→</span>
              </button>
              <Link href="/vip" className="dashboard-action dashboard-action-install" data-testid="button-open-vip">
                <span>Open VIP Hub</span><span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------- Gate: name entry or key re-entry -------------------------------
  return (
    <div className="route-in member-page min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md">
        <div className="border border-border bg-card px-5 py-6">
          <div className="member-head">
            <KeyRound size={18} className="text-accent" />
            <h1 className="text-display text-xl font-bold uppercase tracking-tight">Join RVRSED BIGBULL</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            One-time name entry gets you a unique lifetime key. No login, no password, no account — just your key.
          </p>

          <div className="member-mode-toggle">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={mode === 'register' ? 'member-mode-active' : 'member-mode-inactive'}
            >
              New here
            </button>
            <button
              type="button"
              onClick={() => setMode('recover')}
              className={mode === 'recover' ? 'member-mode-active' : 'member-mode-inactive'}
            >
              Already have a key
            </button>
          </div>

          <form onSubmit={mode === 'register' ? handleRegister : handleRecover} className="mt-4 space-y-3">
            {mode === 'register' ? (
              <>
                <div>
                  <label htmlFor="member-name" className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Name</label>
                  <input
                    id="member-name"
                    type="text"
                    autoComplete="off"
                    maxLength={60}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="What should we call you?"
                    className="member-input"
                    data-testid="input-member-name"
                  />
                </div>
                <div>
                  <label htmlFor="member-email" className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Email (optional)</label>
                  <input
                    id="member-email"
                    type="email"
                    autoComplete="off"
                    maxLength={120}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="member-input"
                    data-testid="input-member-email"
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="member-key" className="text-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Your unique key</label>
                <input
                  id="member-key"
                  type="text"
                  autoComplete="off"
                  maxLength={16}
                  value={recoverKey}
                  onChange={(event) => setRecoverKey(event.target.value.toUpperCase())}
                  placeholder="RNS-XXXXX-XXXXXX"
                  className="member-input"
                  data-testid="input-member-key"
                />
              </div>
            )}

            {error ? (
              <div className="flex items-start gap-2 border border-red-300/40 bg-red-300/10 px-3 py-2 text-[11px] text-red-300" role="alert">
                <X size={12} className="mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="dashboard-action dashboard-action-gold w-full justify-center disabled:opacity-60"
              data-testid="button-member-submit"
            >
              <span>{busy ? 'Creating…' : mode === 'register' ? 'Get my unique key' : 'Restore my key'}</span>
              {busy ? <LoaderCircle size={13} className="spin-slow" /> : <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] uppercase tracking-[.16em] text-muted-foreground">
            Clear browser data? No problem — come back here and re-enter your key.
          </p>
        </div>
      </div>
    </div>
  );
}
