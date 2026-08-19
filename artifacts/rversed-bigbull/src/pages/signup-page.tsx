import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, UserPlus, AlertTriangle } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { getApiBaseUrl } from '@/lib/api-base';

export function SignupPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await response.json()) as { user?: { id: number; email: string }; token?: string; error?: string };
      if (response.ok && data.token) {
        localStorage.setItem('rb_session', data.token);
        setLocation('/gateway');
        return;
      }
      setError(data.error ?? 'Signup failed. Please try again.');
    } catch {
      setError('Could not reach the gateway. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0b0e15] px-5 py-10 text-foreground">
      <div className="grid-surface absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-between">
          <BrandMark />
          <div className="text-mono text-right text-[9px] uppercase tracking-[.22em] text-muted-foreground">
            <div>SECURE PLAYER NETWORK</div>
            <div className="mt-1 text-accent">NODE 07 / AUTH</div>
          </div>
        </div>
        <div className="border border-border bg-card/75 p-6 panel-edge sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-accent/40 text-accent">
              <UserPlus size={17} />
            </div>
            <div>
              <div className="text-display text-2xl uppercase tracking-wide">Create <span className="text-accent">Account</span></div>
              <div className="text-sm text-muted-foreground">Free forever. No payment required.</div>
            </div>
          </div>
          {error && (
            <div className="mb-5 flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-foreground">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="signup-email" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Mail size={13} className="text-muted-foreground" /> Email
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="username"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-border bg-background/60 px-3.5 py-3 text-sm outline-none transition focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Lock size={13} className="text-muted-foreground" /> Password
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-border bg-background/60 px-3.5 py-3 text-sm outline-none transition focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
            >
              <UserPlus size={16} /> {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
          </div>
        </div>
        <div className="mt-5 flex justify-between text-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          <span>Auth gateway / secure</span>
          <span>Build 2.4.7</span>
        </div>
      </div>
    </div>
  );
}
