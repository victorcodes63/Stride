'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type CustomerRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  billingTerms: string | null;
  orderCount: number;
  tripCount: number;
};

export default function FleetCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [billingTerms, setBillingTerms] = useState('Net 30');

  useEffect(() => {
    fetch('/api/fleet/customers')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load customers.');
        setCustomers((await r.json()) as CustomerRow[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/fleet/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contactPhone, billingTerms }),
    });
    if (res.ok) {
      setShowForm(false);
      setName('');
      const json = (await fetch('/api/fleet/customers').then((r) => r.json())) as CustomerRow[];
      setCustomers(json);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Customers"
        description="Manufacturers, distributors, and clients who submit transport requests."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add customer
            </button>
          </div>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard label="Customers" value={customers.length} icon={Building2} />
            <DashboardMetricCard
              label="Total orders"
              value={customers.reduce((s, c) => s + c.orderCount, 0)}
              icon={Building2}
            />
            <DashboardMetricCard
              label="Total trips"
              value={customers.reduce((s, c) => s + c.tripCount, 0)}
              icon={Building2}
            />
          </DashboardStatGrid>

          {showForm ? (
            <DashboardTableCard className="mb-6">
              <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4 p-5">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Company name</span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Phone</span>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Billing terms</span>
                  <input
                    value={billingTerms}
                    onChange={(e) => setBillingTerms(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>
                <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">
                  Save
                </button>
              </form>
            </DashboardTableCard>
          ) : null}

          <DashboardTableCard>
            <DashboardTableViewport>
              {customers.length === 0 ? (
                <DashboardTableEmpty title="No customers" description="Add your first transport customer." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Billing</th>
                      <th>Orders</th>
                      <th>Trips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="col-primary font-medium">{c.name}</td>
                        <td className="col-muted">{c.contactPhone ?? '—'}</td>
                        <td>{c.billingTerms ?? '—'}</td>
                        <td>{c.orderCount}</td>
                        <td>{c.tripCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
