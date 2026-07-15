'use client';

import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';

export function EssServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Dev HMR reuses/changes chunks; a SW that touches /_next/static causes client exceptions.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.filter((r) => r.scope.includes('/ess')).map((r) => r.unregister())),
      );
      return;
    }
    navigator.serviceWorker
      .register('/ess-sw.js', { scope: '/ess/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast.info('A new ESS version is ready. Refresh when convenient.');
            }
          });
        });
      })
      .catch(() => {});
  }, []);
  return null;
}
