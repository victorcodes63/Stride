'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEntity } from '@/components/EntitySwitcher';
import {
  type OutsourcingClientOption,
  resolveOutsourcingClientId,
  writeStoredOutsourcingClientId,
} from '@/lib/outsourcing-client-context';

type UseOutsourcingClientOptions = {
  /** When true, URL may use clientId=all and hook exposes scope 'all'. */
  allowAll?: boolean;
  /** When true, the company's own primary workspace client is excluded from the list. */
  excludePrimary?: boolean;
  /** When false, skip fetching clients (HR & Payroll internal surface). Default true. */
  enabled?: boolean;
};

export function useOutsourcingClient(options: UseOutsourcingClientOptions = {}) {
  const { allowAll = false, excludePrimary = false, enabled = true } = options;
  const { activeEntity } = useEntity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<OutsourcingClientOption[]>([]);
  const [loading, setLoading] = useState(enabled);

  const urlClientId = searchParams.get('clientId');

  useEffect(() => {
    if (!enabled) {
      setClients([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/outsourcing/clients${excludePrimary ? '?excludePrimary=1' : ''}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data.map((c: { id: string; name: string }) => ({
              id: String(c.id),
              name: String(c.name),
            }))
          : [];
        setClients(list);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeEntity.id, excludePrimary, enabled]);

  const scope = useMemo<'all' | 'single'>(() => {
    if (allowAll && urlClientId === 'all') return 'all';
    return 'single';
  }, [allowAll, urlClientId]);

  const clientId = useMemo(() => {
    if (scope === 'all') return '';
    return resolveOutsourcingClientId(clients, urlClientId);
  }, [clients, scope, urlClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const setClientId = useCallback(
    (nextId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = nextId.trim();
      if (allowAll && trimmed === 'all') {
        params.set('clientId', 'all');
        writeStoredOutsourcingClientId(null);
      } else if (trimmed) {
        params.set('clientId', trimmed);
        writeStoredOutsourcingClientId(trimmed);
      } else {
        params.delete('clientId');
        writeStoredOutsourcingClientId(null);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [allowAll, pathname, router, searchParams],
  );

  useEffect(() => {
    if (!enabled) return;
    if (loading || clients.length === 0) return;
    if (scope === 'all') return;
    if (urlClientId === 'all') return;

    const resolved = resolveOutsourcingClientId(clients, urlClientId);
    if (!resolved) return;

    if (urlClientId !== resolved) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('clientId', resolved);
      writeStoredOutsourcingClientId(resolved);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      writeStoredOutsourcingClientId(resolved);
    }
  }, [clients, loading, pathname, router, scope, searchParams, urlClientId, enabled]);

  return {
    clients,
    clientId,
    scope,
    selectedClient,
    setClientId,
    loading,
    showSwitcher: clients.length > 1,
  };
}
