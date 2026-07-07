'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Handshake, Layers, Plus, Search, Users } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  outsourcingClientStatusLabel,
  type OutsourcingClientJson,
  type OutsourcingClientStatus,
} from '@/lib/outsourcing-client';

type ClientRow = OutsourcingClientJson & { label?: string };

function statusTone(status: OutsourcingClientStatus) {
  if (status === 'active') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'suspended') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-neutral-700 bg-neutral-100 border-neutral-200';
}

export default function OutsourcingClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/outsourcing/clients');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load clients');
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.contactName || '').toLowerCase().includes(query) ||
        (c.contactEmail || '').toLowerCase().includes(query) ||
        (c.county || '').toLowerCase().includes(query) ||
        c.status.toLowerCase().includes(query),
    );
  }, [clients, q]);

  const totals = useMemo(() => {
    const totalEmployees = clients.reduce((sum, c) => sum + c.employeeCount, 0);
    const totalDepts = clients.reduce((sum, c) => sum + c.departmentCount, 0);
    const activeClients = clients.filter((c) => c.status === 'active').length;
    return { totalEmployees, totalDepts, totalClients: clients.length, activeClients };
  }, [clients]);

  const listStatus = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (filtered.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [error, filtered.length, loading]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Handshake}
        title="End-client register"
        description="Manage end-clients, service contracts, rate cards, and report delivery settings."
        actions={[
          { href: '/dashboard/outsourcing/clients/new', label: 'Add end-client', icon: Plus, variant: 'primary' },
        ]}
      />

      <DashboardStatGrid columns={4}>
        <DashboardStatCard label="End-clients" value={totals.totalClients} tone="primary" />
        <DashboardStatCard label="Active" value={totals.activeClients} tone="success" />
        <DashboardStatCard label="Outsourced workforce" value={totals.totalEmployees} tone="violet" />
        <DashboardStatCard label="Departments" value={totals.totalDepts} />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <DashboardTableSearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name, contact, county, status..."
            />
          </div>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={listStatus}
          error={error}
          empty={
            <DashboardTableEmpty
              icon={<Building2 className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No end-clients found"
              description={q ? 'Try different search terms.' : 'Add your first end-client to get started.'}
            />
          }
        >
          <DashboardTableViewport minWidth={860}>
            <DashboardTable>
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">End-client</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">County</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">Workforce</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">Departments</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Contract</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Rate card</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/outsourcing/clients/${client.id}`}
                        className="text-sm font-medium text-primary-700 hover:text-primary-900"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(client.status)}`}>
                        {outsourcingClientStatusLabel(client.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-neutral-700">{client.contactName || '—'}</div>
                      {client.contactEmail ? (
                        <div className="text-xs text-neutral-500">{client.contactEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{client.county || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-neutral-700">
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
                        {client.employeeCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-neutral-700">
                        <Layers className="w-3.5 h-3.5 text-neutral-400" />
                        {client.departmentCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {client.contractStartDate
                        ? `${client.contractStartDate}${client.contractEndDate ? ` → ${client.contractEndDate}` : ' → ongoing'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {client.activeRateCard?.lines[0]
                        ? `${client.activeRateCard.lines[0].label}: ${client.currency} ${client.activeRateCard.lines[0].unitAmount}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}
