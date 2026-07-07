'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

const STORAGE_KEY = 'stride.supportOperator';

type SupportContext = {
  operatorEmail: string;
  operatorName: string;
  customerSlug: string;
  expiresAt: string;
};

export function SupportOperatorBanner() {
  const [context, setContext] = useState<SupportContext | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('supportOperator')?.trim();
    if (token) {
      void fetch(`/api/support/operator-context?token=${encodeURIComponent(token)}`)
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as SupportContext;
        })
        .then((data) => {
          if (!data) return;
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          setContext(data);
          params.delete('supportOperator');
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
          window.history.replaceState({}, '', next);
        })
        .catch(() => undefined);
      return;
    }

    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SupportContext;
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setContext(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  if (!context) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Support operator view</p>
        <p className="mt-0.5 text-amber-900/90">
          {context.operatorName || context.operatorEmail} opened {context.customerSlug} (expires{' '}
          {new Date(context.expiresAt).toLocaleString()}). Actions are audited.
        </p>
      </div>
    </div>
  );
}
