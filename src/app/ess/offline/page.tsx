import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function EssOfflinePage() {
  return (
    <div className="ess-app flex min-h-screen flex-col items-center justify-center px-6 text-center ess-safe-top ess-safe-bottom">
      <div className="ess-card max-w-sm p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-600">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[var(--ess-text)]">You are offline</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ess-muted)]">
          Reconnect to sync employee self-service. Recently opened ESS pages may still be available from cache.
        </p>
        <Link href="/ess" className="ess-btn-primary mt-8 w-full">
          Try again
        </Link>
      </div>
    </div>
  );
}
