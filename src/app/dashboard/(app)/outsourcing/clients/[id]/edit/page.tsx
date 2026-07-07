'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { EndClientForm } from '@/components/outsourcing/EndClientForm';
import type { OutsourcingClientJson } from '@/lib/outsourcing-client';

export default function EditOutsourcingClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params.id;
  const [client, setClient] = useState<OutsourcingClientJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/outsourcing/clients/${clientId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load end-client');
        if (!cancelled) setClient(data as OutsourcingClientJson);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load end-client');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <DashboardPage>
      <nav className="mb-4 text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href="/dashboard/outsourcing/clients" className="hover:text-primary-700">
          End clients
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/dashboard/outsourcing/clients/${clientId}`} className="hover:text-primary-700">
          {client?.name ?? 'Client'}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary-900 font-medium">Edit</span>
      </nav>

      <DashboardPageHeader
        icon={Handshake}
        title="Edit end-client"
        description="Update contract, contacts, and client-facing report settings."
      />

      <DashboardAsyncState
        status={loading ? 'loading' : error ? 'error' : 'success'}
        error={error}
        loading={<DashboardPageSkeleton />}
      >
        {client ? (
          <EndClientForm
            initial={client}
            submitLabel="Save changes"
            cancelHref={`/dashboard/outsourcing/clients/${clientId}`}
            onSubmit={async (payload) => {
              const res = await fetch(`/api/outsourcing/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to update end-client');
              router.push(`/dashboard/outsourcing/clients/${clientId}`);
            }}
          />
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
