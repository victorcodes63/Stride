'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'ess_install_prompt_dismissed';

export function EssInstallPrompt() {
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const sync = () => setStandalone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  if (standalone || dismissed) return null;

  return (
    <div className="ess-card mb-4 flex items-start gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--ess-text)]">Install on your phone</p>
        <p className="mt-0.5 text-sm text-[var(--ess-muted)]">
          Add this app to your home screen for quick access.{' '}
          <Link href="/ess/install" className="font-semibold underline">
            How to install
          </Link>
        </p>
        {installEvent ? (
          <button
            type="button"
            className="ess-btn-primary mt-3"
            onClick={() => {
              const promptEvent = installEvent as Event & { prompt?: () => Promise<void> };
              void promptEvent.prompt?.();
              setInstallEvent(null);
            }}
          >
            Install app
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
