// Phone-friendly back button — appears top-right of every dashboard card area.
// Uses history.back() when a previous app page exists; otherwise falls back to the gateway.

import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  function goBack() {
    try {
      const { history } = window;
      if (history.length > 1) {
        const before = window.location.pathname;
        history.back();
        // If the previous entry is outside the app (e.g. user typed the URL directly),
        // history.back() would leave the site — return home after a short guard.
        window.setTimeout(() => {
          if (window.location.pathname === before) window.location.href = '/gateway';
        }, 400);
      } else {
        window.location.href = '/gateway';
      }
    } catch {
      window.location.href = '/gateway';
    }
  }
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back to gateway"
      className="fixed right-3 top-3 z-50 inline-flex items-center gap-1.5 border border-border bg-background/85 px-3 py-2 text-mono text-[9px] uppercase tracking-[.18em] text-foreground backdrop-blur transition hover:bg-card active:translate-y-px md:right-5 md:top-5"
      data-testid="button-back"
    >
      <ArrowLeft size={13} /> Back
    </button>
  );
}
