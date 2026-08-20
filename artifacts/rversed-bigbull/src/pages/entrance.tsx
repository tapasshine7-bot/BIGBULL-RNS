/**
 * Upgraded full-screen glowing terminal startup (Round 16 v3).
 * Replaces the wolf entrance per user request:
 * - Full-screen glowing terminal "machine boot" animation (like the old one, upgraded)
 * - REVERSAL BIGBULL branding, big and centered — not a small box
 * - Very fast: ~3.2s boot, then gateway opens QUICKLY (auto, no stuck state)
 * - Glitch-free: once per session (rns_entry_done), refresh/skip never leaves
 *   the site stuck; gateway always reachable; no audio; works on all devices.
 * On "Enter Gateway" the session flag rns_entry_done is set and the user
 * is navigated to /gateway. On subsequent page loads within the same
 * session the animation is skipped entirely and /gateway opens fast.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight, Radio, Wifi } from "lucide-react";

const CREST_IMAGE = "/entrance/crest.png";

const ENTRY_SESSION_KEY = "rns_entry_done";

const BOOT_LINES = [
  "ENGINE STARTING...",
  "CORE DEPLOYMENT...",
  "DATABASE INITIALIZING...",
  "PARTNER NETWORK CONNECTING...",
  "24×7 SYSTEM MONITORING...",
  "ALL SYSTEMS ONLINE",
];

function useSessionFlag(key: string) {
  const [done] = useState(() => {
    try {
      return window.sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const markDone = () => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* noop */
    }
  };
  return { done, markDone };
}

/** Lightweight 3D-style particle engine — glowing orbs with depth (same feel as old one, red-ember theme). */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    let width = 0;
    let height = 0;
    let pointerX = 0;
    let pointerY = 0;

    function resize() {
      width = canvas.width = window.innerWidth * Math.min(window.devicePixelRatio ?? 1, 2);
      height = canvas.height = window.innerHeight * Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const particleCount = Math.min(90, Math.max(45, Math.round((window.innerWidth * window.innerHeight) / 22000)));
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.0012,
      vy: (Math.random() - 0.5) * 0.0012,
      vz: (Math.random() - 0.5) * 0.0008,
      hue: Math.random() < 0.75 ? 8 + Math.random() * 12 : 210 + Math.random() * 30, // ember reds + ice silvers
      size: 1.2 + Math.random() * 2.2,
    }));

    const onPointer = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer);

    const onVisibility = () => {
      if (document.hidden) cancelled = true;
    };
    document.addEventListener("visibilitychange", onVisibility);

    let raf = 0;
    function draw() {
      if (cancelled) return;
      const t = performance.now() / 1000;
      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      glow.addColorStop(0, "rgba(226, 43, 36, 0.08)");
      glow.addColorStop(0.6, "rgba(12, 16, 26, 0.04)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
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
        ctx.fillStyle = `hsla(${p.hue}, 75%, 68%, ${alpha * pulse})`;
        ctx.fill();
        if (p.z > 0.7) {
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 75%, 68%, ${alpha * 0.12 * pulse})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}

export function Entrance() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState(0);
  const { done: entryDone, markDone } = useSessionFlag(ENTRY_SESSION_KEY);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  };

  const goGateway = (fast: boolean) => {
    markDone();
    const delay = fast ? 250 : 650;
    timersRef.current.push(window.setTimeout(() => navigate("/gateway"), delay));
  };

  // Glitch-free: if the animation was already shown this session, open gateway fast immediately.
  useEffect(() => {
    if (entryDone) {
      goGateway(true);
      return clearTimers;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fast boot: one line every ~520ms (total ~3.1s), then auto-open gateway quickly.
  useEffect(() => {
    if (entryDone) return;
    const step = window.setInterval(() => {
      setStage((current) => {
        if (current >= BOOT_LINES.length - 1) {
          window.clearInterval(step);
          goGateway(false);
          return current;
        }
        return current + 1;
      });
    }, 520);
    clearTimers();
    timersRef.current.push(step as unknown as number);
    return () => {
      window.clearInterval(step);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDone]);

  if (entryDone) return null;

  const bootDone = stage >= BOOT_LINES.length - 1;

  return (
    <main className="entrance-stage relative min-h-[100dvh] overflow-hidden bg-[#060a14] text-foreground">
      <ParticleField />
      <div className="grid-surface absolute inset-0 opacity-40" />

      <header className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between sm:left-6 sm:right-6 sm:top-5">
        <div className="flex items-center gap-3">
          <img src={CREST_IMAGE} alt="RVRSED BIGBULL emblem" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <div className="text-mono text-[9px] uppercase leading-tight tracking-[.22em] text-muted-foreground">
            <div>REVERSAL BIGBULL</div>
            <div className="mt-0.5 text-accent">BOOT SEQUENCE / READY</div>
          </div>
        </div>
        <div className="text-mono text-right text-[9px] uppercase leading-tight tracking-[.22em] text-muted-foreground">
          <div>SECURE PLAYER NETWORK</div>
          <div className="mt-0.5 text-primary">NODE 07 / ONLINE</div>
        </div>
      </header>

      <div className="relative z-10 grid min-h-[100dvh] place-items-center px-4 py-20">
        <div className="w-full max-w-[760px]">
          {/* Giant glowing title */}
          <div className="mb-8 text-center">
            <div className="entrance-title text-display text-5xl font-bold uppercase leading-[1.05] tracking-[.1em] sm:text-7xl md:text-8xl">
              <span className="block text-[#dfe3dd] drop-shadow-[0_2px_0_rgba(0,0,0,.8)]">REVERSAL</span>
              <span className="block entrance-title-red drop-shadow-[0_2px_0_rgba(0,0,0,.8)]">BIGBULL</span>
            </div>
            <div className="mx-auto mt-4 h-px w-48 bg-gradient-to-r from-transparent via-[#e22b24] to-transparent" />
          </div>

          {/* Terminal boot panel */}
          <div className="boot-panel border border-accent/30 bg-card/60 p-5 backdrop-blur-sm panel-edge sm:p-7">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div className="text-mono text-[10px] uppercase tracking-[.2em] text-primary">BOOT PROTOCOL</div>
              <div className="relative grid h-9 w-9 place-items-center border border-accent/40 text-accent">
                <Radio size={16} className="signal-pulse" />
                <span className="absolute inset-1 border border-accent/20" />
              </div>
            </div>
            <div className="space-y-2.5">
              {BOOT_LINES.map((name, index) => (
                <div
                  key={name}
                  className={`flex items-center gap-3 text-mono text-[10px] tracking-[.14em] transition duration-500 sm:text-[11px] ${
                    index <= stage ? "text-foreground" : "text-muted-foreground/40"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center border ${
                      index < stage
                        ? "border-accent bg-accent text-background"
                        : index === stage
                          ? "border-primary text-primary"
                          : "border-border"
                    }`}
                  >
                    {index < stage ? <Check size={10} /> : index === stage ? <span className="h-1.5 w-1.5 bg-primary" /> : null}
                  </span>
                  <span>{name}</span>
                  {index === stage && <span className="ml-auto text-primary">ACTIVE</span>}
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex justify-between text-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>System load</span>
                <span className="text-accent">{Math.min(100, Math.round(((stage + 1) / BOOT_LINES.length) * 100))}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-secondary">
                <div
                  className="relative h-full bg-primary transition-all duration-300"
                  style={{ width: `${((stage + 1) / BOOT_LINES.length) * 100}%` }}
                >
                  <div className="startup-scan absolute inset-y-0 w-1/4 bg-primary-foreground/30" />
                </div>
              </div>
            </div>

            {/* Live system monitor grid */}
            <div className="mt-5 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
              <div className="text-mono col-span-full text-[9px] uppercase tracking-[.2em] text-muted-foreground">
                System monitor / live
              </div>
              {[
                ["CORE", "ONLINE", "online"],
                ["DATABASE", "ONLINE", "online"],
                ["PARTNER NETWORK", stage >= 3 ? "ONLINE" : "CHECKING", stage >= 3 ? "online" : "checking"],
                ["24×7 MONITORING", "ACTIVE", "online"],
              ].map(([label, value, tone]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between border border-border/70 bg-background/40 px-3 py-2 text-mono text-[9px] uppercase tracking-wider"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${tone === "online" ? "bg-accent" : "bg-primary signal-pulse"}`} />
                    {label}
                  </span>
                  <span className={tone === "online" ? "text-accent" : "text-primary"}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enter button */}
          {bootDone && (
            <div className="mt-7 text-center">
              <button
                type="button"
                onClick={() => goGateway(false)}
                className="entry-enter-btn inline-flex items-center gap-2 border border-accent/60 bg-accent/10 px-8 py-3.5 text-mono text-sm uppercase tracking-[.22em] text-accent transition hover:bg-accent/20 sm:px-10"
                data-testid="button-enter-gateway"
              >
                ENTER GATEWAY <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${bootDone ? "bg-accent" : "bg-primary signal-pulse"}`} />
            {bootDone ? "All systems online — opening gateway…" : "Initializing terminal…"}
          </div>
        </div>
      </div>

      <footer className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:left-6 sm:right-6 sm:bottom-4">
        <span className="flex items-center gap-1.5">Live monitor / nominal <Wifi size={10} className="text-accent" /></span>
        <span>Build 2.5.0</span>
      </footer>
    </main>
  );
}

export default Entrance;
