'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { EndClientForm } from '@/components/outsourcing/EndClientForm';

export default function NewOutsourcingClientPage() {
  const router = useRouter();

  return (
    <DashboardPage>
      <nav className="mb-4 text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href="/dashboard/outsourcing/clients" className="hover:text-primary-700">
          End clients
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary-900 font-medium">Add end-client</span>
      </nav>

      <DashboardPageHeader
        icon={Handshake}
        title="Add end-client"
        description="Register a new end-client with contract details and report delivery settings."
      />

      <EndClientForm
        submitLabel="Create end-client"
        cancelHref="/dashboard/outsourcing/clients"
        onSubmit={async (payload) => {
          const res = await fetch('/api/outsourcing/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to create end-client');
          router.push(`/dashboard/outsourcing/clients/${data.id}?welcome=1`);
        }}
      />
    </DashboardPage>
  );
}
