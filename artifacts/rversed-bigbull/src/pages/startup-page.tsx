import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Check, ChevronRight, Radio, Wrench } from 'lucide-react';
import type { MaintenanceScope } from '@/lib/admin';
import { BrandMark } from '@/components/brand-mark';
import type { AdminMaintenance } from '@/lib/admin';
import { fetchBannerState } from '@/lib/admin';

const stages = [
  'ENGINE STARTING...',
  'CORE DEPLOYMENT...',
  'DATABASE INITIALIZING...',
  'PARTNER NETWORK CONNECTING...',
  '24×7 SYSTEM MONITORING...',
  'ALL SYSTEMS ONLINE',
];

const ENTRY_SESSION_KEY = 'rns_entry_done';
const ENTRY_BOOT_LINES = [
  'ENGINE STARTING...',
  'CORE DEPLOYMENT...',
  'DATABASE INITIALIZING...',
  'PARTNER NETWORK CONNECTING...',
  '24×7 SYSTEM MONITORING...',
  'ALL SYSTEMS ONLINE',
];

function useSessionFlag(key: string) {
  const [done] = useState(() => {
    try {
      return window.sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  return { done, markDone: () => { try { window.sessionStorage.setItem(key, '1'); } catch { /* noop */ } } };
}

/** Lightweight 3D-style particle engine — floating depth-sorted orbs that respond to touch/move. */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current as HTMLCanvasElement;
    const ctx: CanvasRenderingContext2D = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!canvas || !ctx) return;
    let cancelled = false;
    let width = 0;
    let height = 0;
    let pointerX = width / 2;
    let pointerY = height / 2;

    function resize() {
      width = canvas.width = window.innerWidth * Math.min(window.devicePixelRatio ?? 1, 2);
      height = canvas.height = window.innerHeight * Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener('resize', resize);

    const particleCount = Math.min(90, Math.max(45, Math.round((window.innerWidth * window.innerHeight) / 22000)));
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.0012,
      vy: (Math.random() - 0.5) * 0.0012,
      vz: (Math.random() - 0.5) * 0.0008,
      hue: 160 + Math.random() * 60,
      size: 1.2 + Math.random() * 2.2,
    }));

    function onPointer(event: PointerEvent) {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('pointermove', onPointer);

    const onVisibility = () => { if (document.hidden) cancelled = true; };
    document.addEventListener('visibilitychange', onVisibility);

    let raf = 0;
    function draw() {
      if (cancelled) return;
      const t = performance.now() / 1000;
      ctx.clearRect(0, 0, width, height);
      // soft radial glow behind the scene
      const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      glow.addColorStop(0, 'rgba(45, 212, 191, 0.07)');
      glow.addColorStop(0.6, 'rgba(16, 185, 129, 0.03)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx + (pointerX - p.x) * 0.0004;
        p.y += p.vy + (pointerY - p.y) * 0.0004;
        p.z += p.vz;
        if (p.z > 1) { p.z = 0; p.x = (Math.random() - 0.5) * 2; p.y = (Math.random() - 0.5) * 2; }
        if (p.z < 0) { p.z = 1; p.x = (Math.random() - 0.5) * 2; p.y = (Math.random() - 0.5) * 2; }
        if (p.x > 1.3) p.x = -1.3; if (p.x < -1.3) p.x = 1.3;
        if (p.y > 1.3) p.y = -1.3; if (p.y < -1.3) p.y = 1.3;
        const perspective = 1 / (0.6 + p.z);
        const sx = (p.x * 0.7 + pointerX * 0.15) * width / 2 + width / 2;
        const sy = (p.y * 0.7 + pointerY * 0.15) * height / 2 + height / 2;
        const radius = p.size * perspective * Math.min(window.devicePixelRatio ?? 1, 2);
        const alpha = 0.15 + p.z * 0.55;
        const pulse = 0.8 + 0.2 * Math.sin(t * 2 + p.z * 10);
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${alpha * pulse})`;
        ctx.fill();
        if (p.z > 0.7) {
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${alpha * 0.12 * pulse})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}

export function StartupPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState(0);
  const [maintenance, setMaintenance] = useState<AdminMaintenance>(null);
  const entry = useSessionFlag(ENTRY_SESSION_KEY);
  const bootDone = stage >= ENTRY_BOOT_LINES.length - 1;

  function enterGateway() {
    entry.markDone();
    setLocation('/gateway');
  }

  useEffect(() => {
    // Never block the boot animation: maintenance is checked in the background.
    void fetchBannerState().then((state) => setMaintenance(state.maintenance));
    // Poll for maintenance changes (in case admin enables it while on this screen), and refresh when the page regains focus.
    const timer = window.setInterval(() => {
      void fetchBannerState().then((state) => setMaintenance(state.maintenance));
    }, 5000);
    const onFocus = () => void fetchBannerState().then((state) => setMaintenance(state.maintenance));
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStage((current) => {
        if (current >= stages.length - 1) return current;
        return current + 1;
      });
    }, 260);

    return () => window.clearInterval(timer);
  }, []);

  // The startup/gateway screen only shows maintenance for scope 'both'.
  // Per-dashboard maintenance (bio / vip) is handled inside bio-page / vip-page themselves.
  const activeMaintenanceScope: MaintenanceScope | null =
    maintenance?.enabled && maintenance.scope === 'both' ? maintenance.scope : null;
  const isUpdateMode = Boolean(maintenance?.enabled && maintenance.mode === 'update');

  // Entry splash: 3D particle field + engine boot, with a manual "ENTER GATEWAY" button.
  // Shown once per browser session (sessionStorage) — first-time visitors get the animation,
  // returning tabs skip straight to the auto-boot terminal.
  // Already saw the entry splash this session: skip straight to the gateway.
  // (The old "boot protocol" terminal had no way forward and left visitors stuck.)
  useEffect(() => {
    if (entry.done) {
      const timer = window.setTimeout(() => setLocation('/gateway'), 300);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [entry.done, setLocation]);

  if (entry.done) return null;

  if (!entry.done) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0e15] text-foreground">
        <ParticleField />
        <div className="grid-surface absolute inset-0 opacity-40" />
        <div className="relative z-10 grid min-h-[100dvh] place-items-center px-5">
          <div className="w-full max-w-[560px] text-center">
            <div className="mb-8 flex items-center justify-between">
              <BrandMark />
              <div className="text-mono text-right text-[9px] uppercase tracking-[.22em] text-muted-foreground">
                <div>SECURE PLAYER NETWORK</div>
                <div className="mt-1 text-accent">NODE 07 / READY</div>
              </div>
            </div>
            <div className="mb-10 text-display text-4xl font-bold uppercase tracking-[.18em] sm:text-5xl">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">RNS BIGBULL</span>
            </div>
            <div className="mx-auto mb-8 grid max-w-[380px] place-items-center border border-accent/30 bg-card/40 p-5 backdrop-blur-sm panel-edge">
              <div className="space-y-2.5 text-left">
                {ENTRY_BOOT_LINES.map((name, index) => (
                  <div
                    key={name}
                    className={`flex items-center gap-3 text-mono text-[10px] tracking-[.14em] transition duration-500 ${index <= stage ? 'text-foreground' : 'text-muted-foreground/40'}`}
                  >
                    <span className={`grid h-4 w-4 place-items-center border ${index < stage ? 'border-accent bg-accent text-background' : index === stage ? 'border-primary text-primary' : 'border-border'}`}>
                      {index < stage ? <Check size={10} /> : index === stage ? <span className="h-1.5 w-1.5 bg-primary" /> : null}
                    </span>
                    <span>{name}</span>
                    {index === stage && <span className="ml-auto text-primary">ACTIVE</span>}
                  </div>
                ))}
              </div>
              <div className="mt-5 h-1 w-full overflow-hidden bg-secondary">
                <div className="relative h-full bg-primary transition-all duration-300" style={{ width: `${((stage + 1) / ENTRY_BOOT_LINES.length) * 100}%` }}>
                  <div className="startup-scan absolute inset-y-0 w-1/4 bg-primary-foreground/30" />
                </div>
              </div>
            </div>
            {bootDone ? (
              <button
                type="button"
                onClick={enterGateway}
                className="entry-enter-btn inline-flex items-center gap-2 border border-accent/60 bg-accent/10 px-8 py-3.5 text-mono text-sm uppercase tracking-[.22em] text-accent transition hover:bg-accent/20"
                data-testid="button-enter-gateway"
              >
                Enter Gateway <ChevronRight size={16} />
              </button>
            ) : (
              <div className="text-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary signal-pulse" /> Initializing terminal…
              </div>
            )}
            <div className="mt-8 flex justify-between text-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>Live monitor / nominal</span>
              <span>Build 2.4.7</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeMaintenanceScope) {
    return (
      <div className="grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0b0e15] px-5 text-foreground">
        <div className="grid-surface absolute inset-0 opacity-40" />
        <div className="relative w-full max-w-[520px] text-center">
          <div className="mb-10 flex items-center justify-between">
            <BrandMark />
            <div className="text-mono text-right text-[9px] uppercase tracking-[.22em] text-muted-foreground">
              <div>SECURE PLAYER NETWORK</div>
              <div className="mt-1 text-amber-300">NODE 07 / NETWORK STANDBY</div>
            </div>
          </div>
          <div className="border border-border bg-card/75 p-6 panel-edge sm:p-8">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center border border-amber-300/50 text-amber-300">
              <Wrench size={24} strokeWidth={1} className="signal-pulse" />
            </div>
            <div className="text-mono mb-3 text-[10px] uppercase tracking-[.2em] text-amber-300">{isUpdateMode ? 'Update' : 'Maintenance'} mode / network</div>
            <h1 className="text-display text-2xl font-bold uppercase tracking-wider">Temporarily offline</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {maintenance?.message || 'We are performing scheduled maintenance. The network will be back shortly.'}
            </p>
            <div className="mt-7 flex items-center gap-2 justify-center text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 signal-pulse" />
              Checking every few seconds…
            </div>
            {maintenance?.scheduledEnd ? (
              <div className="mt-3 text-mono text-[9px] uppercase tracking-[.2em] text-amber-300">
                Auto-reopens at {(() => {
                  const d = new Date(maintenance!.scheduledEnd!);
                  return Number.isNaN(d.valueOf())
                    ? maintenance!.scheduledEnd!
                    : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
                })()}
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex justify-between text-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            <span>Live monitor / standby</span>
            <span>Build 2.4.7</span>
          </div>
        </div>
      </div>
    );
  }

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