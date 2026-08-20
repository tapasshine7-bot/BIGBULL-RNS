/**
 * Silent cinematic wolf entrance for RNS BigBull (Round 16).
 * NO audio — user explicitly removed all sound.
 * Stages: ready -> run (180ms) -> impact (4300ms) -> revealed (5350ms).
 * On "Enter Gateway" the session flag rns_entry_done is set and the user
 * is navigated to /gateway. On subsequent page loads within the same
 * session the animation is skipped entirely.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { RotateCcw } from "lucide-react";

const WOLF_IMAGE = "/entrance/wolf-hero.webp";
const BACKDROP_IMAGE = "/entrance/backdrop.jpg";
const CLAW_IMAGE = "/entrance/claw-impact.png";
const CREST_IMAGE = "/entrance/crest.png";

const ENTRY_SESSION_KEY = "rns_entry_done";

type SequenceStage = "ready" | "run" | "impact" | "revealed";

export function Entrance() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<SequenceStage>("ready");
  const [sequence, setSequence] = useState(0);
  const [hasLaunched, setHasLaunched] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(pointer: coarse), (max-width: 640px)").matches;
  });
  const [entered, setEntered] = useState(false);
  const timersRef = useRef<number[]>([]);

  // Skip the animation entirely if already shown in this browser session.
  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage?.getItem(ENTRY_SESSION_KEY) === "1") {
      navigate("/gateway", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSequence = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  }, []);

  const beginSequence = useCallback(() => {
    clearSequence();
    setEntered(false);
    setStage("ready");
    setSequence((current) => current + 1);

    timersRef.current = [
      window.setTimeout(() => setStage("run"), 180),
      window.setTimeout(() => setStage("impact"), 4300),
      window.setTimeout(() => setStage("revealed"), 5350),
    ];
  }, [clearSequence]);

  useEffect(() => {
    if (!hasLaunched) return;
    beginSequence();
    return clearSequence;
  }, [beginSequence, clearSequence, hasLaunched]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r") beginSequence();
      if (event.key === "Enter" && stage === "revealed") setEntered(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [beginSequence, stage]);

  const enterGateway = useCallback(() => {
    setEntered(true);
    window.sessionStorage.setItem(ENTRY_SESSION_KEY, "1");
    // Give the "GATEWAY OPEN" overlay a brief moment to register, then navigate.
    window.setTimeout(() => navigate("/gateway"), 700);
  }, [navigate]);

  return (
    <main className={`entrance stage-${stage} ${entered ? "is-entered" : ""} ${hasLaunched ? "" : "is-waiting"}`}>
      <div className="grain" aria-hidden="true" />
      <div className="backdrop" style={{ backgroundImage: `url(${BACKDROP_IMAGE})` }} aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="horizon-pulse" aria-hidden="true" />
      <div className="atmosphere atmosphere-one" aria-hidden="true" />
      <div className="atmosphere atmosphere-two" aria-hidden="true" />

      <header className="entrance-header">
        <div className="brand-stamp" aria-label="RNS BigBull">
          <img src={CREST_IMAGE} alt="" />
          <span>RB / 01</span>
        </div>
        <span className="status-line">WILD SIGNAL / ONLINE</span>
      </header>

      {!hasLaunched && (
        <section className="mobile-launch" aria-label="Start the RNS BigBull entrance">
          <img src={CREST_IMAGE} alt="" />
          <p>WOLF SIGNAL DETECTED</p>
          <strong>UNLEASH THE GATEWAY</strong>
          <button type="button" onClick={() => setHasLaunched(true)}>
            <span>START INTRO</span>
            <span aria-hidden="true">▶</span>
          </button>
          <small>TAP TO ENABLE MOTION</small>
        </section>
      )}

      <section key={`wolf-${sequence}`} className="wolf-chamber" aria-label="Animated wolf arrival">
        <div className="wolf-shadow" aria-hidden="true" />
        <img className="wolf" src={WOLF_IMAGE} alt="A powerful gray wolf running forward" />
        <img className="wolf-echo" src={WOLF_IMAGE} alt="" aria-hidden="true" />
        <div className="wolf-eyes" aria-hidden="true"><i /><i /></div>
        <div className="impact-flash" aria-hidden="true" />
      </section>

      <div key={`tear-${sequence}`} className="tear-stage" aria-hidden="true">
        <div className="tear-panel tear-panel-left" />
        <div className="tear-panel tear-panel-right" />
        <div className="tear-core" />
        <img className="claw-impact" src={CLAW_IMAGE} alt="" />
        <div className="tear-ember ember-one" />
        <div className="tear-ember ember-two" />
        <div className="tear-ember ember-three" />
      </div>

      <section key={`identity-${sequence}`} className="identity" aria-live="polite">
        <p className="eyebrow">THE TURN STARTS HERE</p>
        <h1>
          <span>RNS</span>
          <span>BIGBULL</span>
        </h1>
        <div className="title-rule" />
        <p className="subline">CROSS THE LINE. CLAIM THE MOMENT.</p>
        <button
          type="button"
          className="gateway-button"
          onClick={enterGateway}
          aria-label="Enter the RNS BigBull gateway"
        >
          <span>ENTER GATEWAY</span>
          <span className="button-mark" aria-hidden="true">↗</span>
        </button>
        <p className="key-tip">PRESS ENTER TO CROSS</p>
      </section>

      <div className="access-granted" role="status">
        <span>GATEWAY OPEN</span>
        <strong>WELCOME INSIDE</strong>
      </div>

      <footer className="entrance-footer">
        <button type="button" className="sequence-button" onClick={beginSequence}>
          RUN INTRO <span aria-hidden="true">▶</span>
        </button>
        <button type="button" className="utility-button" onClick={beginSequence}>
          <RotateCcw size={14} strokeWidth={1.7} />
          <span>REPLAY</span>
        </button>
      </footer>
    </main>
  );
}

export default Entrance;
