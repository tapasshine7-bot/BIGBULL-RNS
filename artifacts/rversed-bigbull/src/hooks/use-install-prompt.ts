import { useEffect, useState } from 'react';

type PromptEvent = Event & {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): void;
};

/** Returns a function that triggers the native install prompt when available, else null. */
export function useInstallPrompt(): (() => void) | null {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as PromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    // Already installed: window.matchMedia('display-mode: standalone') also works,
    // but iOS doesn't fire beforeinstallprompt; rely on the button being hidden when promptEvent is null.
    const markInstalled = () => setPromptEvent(null);
    window.addEventListener('appinstalled', markInstalled);
    return () => window.removeEventListener('appinstalled', markInstalled);
  }, []);

  return promptEvent ? () => promptEvent.prompt() : null;
}

/** True when the site is already running as an installed app. */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)').matches ||
        ((window.navigator as unknown as { standalone?: boolean }).standalone === true)
      : false
  );
  return standalone;
}
