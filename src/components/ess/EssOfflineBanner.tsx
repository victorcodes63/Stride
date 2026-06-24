'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function EssOfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-600 px-3 py-2 text-center text-sm font-bold text-white shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      You are offline. Some actions are unavailable.
    </div>
  );
}
