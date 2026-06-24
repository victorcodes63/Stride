'use client';

import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';

export function EssServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
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
