import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Radio } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

const stages = [
  'ENGINE STARTING...',
  'CORE DEPLOYMENT...',
  'DATABASE INITIALIZING...',
  'PARTNER NETWORK CONNECTING...',
  '24×7 SYSTEM MONITORING...',
  'ALL SYSTEMS ONLINE',
];

export function StartupPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState(0);
  const [guest, setGuest] = useState<boolean | null>(null);

  useEffect(() => {
    setGuest(!localStorage.getItem('rb_session'));
  }, []);

  useEffect(() => {
    if (guest) {
      setLocation('/login');
      return;
    }
    const timer = window.setInterval(() => {
      setStage((current) => {
        if (current >= stages.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => setLocation('/gateway'), 400);
          return current;
        }
        return current + 1;
      });
    }, 260);

    return () => window.clearInterval(timer);
  }, [setLocation, guest]);

  if (guest === null) return null;

  return (
    <div className="grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0b0e15] px-5 text-foreground">
      <div className="grid-surface absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-[650px]">
        <div className="mb-10 flex items-center justify-between">
          <BrandMark />
          <div className="text-mono text-right text-[9px] uppercase tracking-[.22em] text-muted-foreground">
            <div>SECURE PLAYER NETWORK</div>
            <div className="mt-1 text-accent">NODE 07 / READY</div>
          </div>
        </div>
        <div className="border border-border bg-card/75 p-5 panel-edge sm:p-8">
          <div className="mb-8 flex items-center justify-between border-b border-border pb-5">
            <div>
              <div className="text-mono text-[10px] uppercase tracking-[.2em] text-primary">Boot protocol</div>
              <div className="mt-2 text-display text-3xl uppercase tracking-widest">RVRSED BIGBULL</div>
            </div>
            <div className="relative grid h-14 w-14 place-items-center border border-accent/40 text-accent">
              <Radio size={22} className="signal-pulse" />
              <span className="absolute inset-2 border border-accent/20" />
            </div>
          </div>
          <div className="space-y-3">
            {stages.map((name, index) => (
              <div
                key={name}
                className={`flex items-center gap-3 text-mono text-[10px] tracking-[.14em] transition ${
                  index <= stage ? 'text-foreground' : 'text-muted-foreground/40'
                }`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center border ${
                    index < stage
                      ? 'border-accent bg-accent text-background'
                      : index === stage
                        ? 'border-primary text-primary'
                        : 'border-border'
                  }`}
                >
                  {index < stage ? (
                    <Check size={10} />
                  ) : index === stage ? (
                    <span className="h-1.5 w-1.5 bg-primary" />
                  ) : null}
                </span>
                <span>{name}</span>
                {index === stage && <span className="ml-auto text-primary">ACTIVE</span>}
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-border pt-5">
            <div className="mb-2 flex justify-between text-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <span>System load</span>
              <span className="text-accent">
                {Math.min(100, Math.round(((stage + 1) / stages.length) * 100))}%
              </span>
            </div>
            <div className="h-1 overflow-hidden bg-secondary">
              <div
                className="relative h-full bg-primary transition-all duration-300"
                style={{ width: `${((stage + 1) / stages.length) * 100}%` }}
              >
                <div className="startup-scan absolute inset-y-0 w-1/4 bg-primary-foreground/30" />
              </div>
            </div>
          </div>
          <div className="mt-7 grid gap-2 border-t border-border pt-5 sm:grid-cols-2">
            <div className="text-mono col-span-full text-[9px] uppercase tracking-[.2em] text-muted-foreground">
              System monitor / live
            </div>
            {[
              ['CORE', 'ONLINE', 'online'],
              ['DATABASE', 'ONLINE', 'online'],
              ['PARTNER NETWORK', stage >= 3 ? 'ONLINE' : 'CHECKING', stage >= 3 ? 'online' : 'checking'],
              ['24×7 MONITORING', 'ACTIVE', 'online'],
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className="flex items-center justify-between border border-border/70 bg-background/40 px-3 py-2 text-mono text-[9px] uppercase tracking-wider"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tone === 'online' ? 'bg-accent' : 'bg-primary signal-pulse'
                    }`}
                  />
                  {label}
                </span>
                <span className={tone === 'online' ? 'text-accent' : 'text-primary'}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-between text-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          <span>Live monitor / nominal</span>
          <span>Build 2.4.7</span>
        </div>
      </div>
    </div>
  );
}