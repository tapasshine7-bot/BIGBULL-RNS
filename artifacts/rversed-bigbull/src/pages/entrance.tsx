import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useLocation } from "wouter";

const ENTRY_SESSION_KEY = "rns_entry_done";

const STATUS_STEPS = ["LINKING CORE", "CALIBRATING PORTAL", "DESKTOP MODE READY"];

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
      // Storage can be unavailable in privacy-focused browser modes.
    }
  };

  return { done, markDone };
}

function PortalRings({ progress }: { progress: number }) {
  return (
    <div className="aurora-portal" aria-hidden="true">
      <div className="aurora-portal-glow" />
      <div className="aurora-ring aurora-ring-outer" />
      <div className="aurora-ring aurora-ring-middle" />
      <div className="aurora-ring aurora-ring-inner" />
      <div className="aurora-scan-beam" />
      <div className="aurora-core">
        <div className="aurora-core-halo" />
        <div className="aurora-core-point" />
      </div>
      <div className="aurora-progress-orbit" style={{ "--portal-progress": `${progress * 3.6}deg` } as React.CSSProperties} />
      <span className="aurora-node aurora-node-one" />
      <span className="aurora-node aurora-node-two" />
      <span className="aurora-node aurora-node-three" />
    </div>
  );
}

export function Entrance() {
  const [, navigate] = useLocation();
  const { done: entryDone, markDone } = useSessionFlag(ENTRY_SESSION_KEY);
  const [progress, setProgress] = useState(0);
  const navigationTimerRef = useRef<number | null>(null);

  const clearNavigationTimer = () => {
    if (navigationTimerRef.current !== null) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  };

  const enterGateway = () => {
    clearNavigationTimer();
    markDone();
    navigationTimerRef.current = window.setTimeout(() => navigate("/gateway"), 240);
  };

  useEffect(() => {
    if (!entryDone) return undefined;
    navigationTimerRef.current = window.setTimeout(() => navigate("/gateway"), 120);
    return clearNavigationTimer;
  }, [entryDone, navigate]);

  useEffect(() => {
    if (entryDone) return undefined;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 5);
        if (next === 100) {
          window.clearInterval(timer);
          navigationTimerRef.current = window.setTimeout(enterGateway, 620);
        }
        return next;
      });
    }, 105);

    return () => {
      window.clearInterval(timer);
      clearNavigationTimer();
    };
  }, [entryDone]);

  if (entryDone) return null;

  const statusIndex = progress < 38 ? 0 : progress < 82 ? 1 : 2;
  const isReady = progress === 100;

  return (
    <main className="aurora-gateway-stage" aria-label="REVANANCE gateway initialization">
      <div className="aurora-grid" aria-hidden="true" />
      <div className="aurora-mist aurora-mist-left" aria-hidden="true" />
      <div className="aurora-mist aurora-mist-right" aria-hidden="true" />

      <header className="aurora-header">
        <div className="aurora-header-brand">
          <span className="aurora-status-dot" aria-hidden="true" />
          <span>REVANANCE</span>
        </div>
        <span className="aurora-header-mode">GATEWAY CONTROL</span>
        <button type="button" className="aurora-skip" onClick={enterGateway} aria-label="Skip gateway animation">
          <X size={13} /> <span>SKIP</span>
        </button>
      </header>

      <section className="aurora-gateway-content">
        <div className="aurora-side-status aurora-side-status-left" aria-hidden="true">
          <span className="aurora-side-label">SYSTEM</span>
          <span className="aurora-side-value">SECURE</span>
        </div>
        <div className="aurora-side-status aurora-side-status-right" aria-hidden="true">
          <span className="aurora-side-label">MODE</span>
          <span className="aurora-side-value">DESKTOP</span>
        </div>

        <PortalRings progress={progress} />

        <div className="aurora-copy" aria-live="polite">
          <p className="aurora-eyebrow">LIVE PORTAL SEQUENCE</p>
          <h1>REVANANCE <span>GATEWAY</span></h1>
          <p className="aurora-status-copy">{STATUS_STEPS[statusIndex]}</p>
          <div className="aurora-progress" aria-label={`${progress}% initialized`}>
            <div className="aurora-progress-track"><span style={{ width: `${progress}%` }} /></div>
            <span className="aurora-progress-number">{progress}%</span>
          </div>
          <p className="aurora-ready-copy">{isReady ? "ACCESS ROUTE OPENING" : "INITIALIZING SECURE DESKTOP MODE"}</p>
        </div>
      </section>

      <footer className="aurora-footer">
        <span><i /> SECURE SESSION</span>
        <span>ADAPTIVE INTERFACE</span>
      </footer>

      <button type="button" onClick={enterGateway} className="aurora-enter" data-testid="button-enter-gateway">
        {isReady ? "ENTER GATEWAY" : "OPEN NOW"} <ChevronRight size={15} />
      </button>
    </main>
  );
}

export default Entrance;
