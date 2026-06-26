'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Plus, Route } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import type { FleetOrderListRow } from '@/lib/fleet-orders-api';
import { fleetOrderStatusBadgeClass } from '@/lib/fleet-order-status';

type Customer = { id: string; name: string };

export default function FleetOrdersPage() {
  const searchParams = useSearchParams();
  const showNew = searchParams.get('new') === '1';

  const [orders, setOrders] = useState<FleetOrderListRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(showNew);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (showNew) setShowForm(true);
  }, [showNew]);

  const [form, setForm] = useState({
    customerId: '',
    pickupLocation: '',
    deliveryLocation: '',
    cargoType: '',
    cargoWeightKg: '',
    truckRequirements: '',
    requestedPickupAt: '',
    deliveryDeadlineAt: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, customersRes] = await Promise.all([
        fetch('/api/fleet/orders'),
        fetch('/api/fleet/customers'),
      ]);
      if (!ordersRes.ok || !customersRes.ok) throw new Error('Unable to load orders.');
      setOrders((await ordersRes.json()) as FleetOrderListRow[]);
      setCustomers((await customersRes.json()) as Customer[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const draft = orders.filter((o) => o.status === 'draft').length;
    const validated = orders.filter((o) => o.status === 'validated').length;
    const active = orders.filter((o) => o.status === 'assigned' || o.status === 'in_progress').length;
    return { draft, validated, active, total: orders.length };
  }, [orders]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/fleet/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cargoWeightKg: form.cargoWeightKg ? parseInt(form.cargoWeightKg, 10) : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to create order.');
      setShowForm(false);
      setForm({
        customerId: '',
        pickupLocation: '',
        deliveryLocation: '',
        cargoType: '',
        cargoWeightKg: '',
        truckRequirements: '',
        requestedPickupAt: '',
        deliveryDeadlineAt: '',
        notes: '',
      });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function validateOrder(id: string) {
    const res = await fetch(`/api/fleet/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate' }),
    });
    if (res.ok) await load();
  }

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Transport orders"
        description="Customer order intake — validate shipment details, schedule jobs, and assign to managed fleet or outsourced partners."
        actions={[{ href: '/dashboard/fleet/orders?new=1', label: 'New order', icon: Plus }]}
      />

      <DashboardAsyncState
        status={listStatus}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        <>
          <DashboardStatGrid>
            <DashboardMetricCard label="Total orders" value={stats.total} icon={ClipboardList} />
            <DashboardMetricCard label="Draft" value={stats.draft} icon={ClipboardList} />
            <DashboardMetricCard label="Validated" value={stats.validated} icon={ClipboardList} tone="info" />
            <DashboardMetricCard label="Active" value={stats.active} icon={Route} tone="primary" />
          </DashboardStatGrid>

          {showForm ? (
            <DashboardTableCard className="mb-6">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">New transport order</h2>
              </div>
              <form onSubmit={handleCreate} className="space-y-4 p-5">
                {formError ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Customer</span>
                    <select
                      required
                      value={form.customerId}
                      onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Cargo type</span>
                    <input
                      value={form.cargoType}
                      onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
                      placeholder="e.g. Cement bags, beverages"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Pickup location</span>
                    <input
                      required
                      value={form.pickupLocation}
                      onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
                      placeholder="e.g. Nairobi — Industrial Area"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Delivery destination</span>
                    <input
                      required
                      value={form.deliveryLocation}
                      onChange={(e) => setForm({ ...form, deliveryLocation: e.target.value })}
                      placeholder="e.g. Mombasa — Port Reitz"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Weight (kg)</span>
                    <input
                      type="number"
                      value={form.cargoWeightKg}
                      onChange={(e) => setForm({ ...form, cargoWeightKg: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Truck requirements</span>
                    <input
                      value={form.truckRequirements}
                      onChange={(e) => setForm({ ...form, truckRequirements: e.target.value })}
                      placeholder="e.g. 28T prime mover, refrigerated"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-neutral-700">Delivery deadline</span>
                    <input
                      type="datetime-local"
                      value={form.deliveryDeadlineAt}
                      onChange={(e) => setForm({ ...form, deliveryDeadlineAt: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium text-neutral-700">Requested pickup</span>
                    <input
                      type="datetime-local"
                      value={form.requestedPickupAt}
                      onChange={(e) => setForm({ ...form, requestedPickupAt: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </DashboardTableCard>
          ) : null}

          <DashboardTableCard>
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">Order register</h2>
            </div>
            <DashboardTableViewport>
              {orders.length === 0 ? (
                <DashboardTableEmpty
                  title="No transport orders"
                  description="Create a customer order or run the fleet demo seed to populate sample data."
                />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Route</th>
                      <th>Cargo</th>
                      <th>Status</th>
                      <th className="col-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="col-primary font-medium">
                          <Link
                            href={`/dashboard/fleet/orders/${order.id}`}
                            className="text-primary-600 hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td>{order.customerName}</td>
                        <td className="col-muted text-sm">
                          {order.pickupLocation} → {order.deliveryLocation}
                        </td>
                        <td className="text-sm">{order.cargoType ?? '—'}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${fleetOrderStatusBadgeClass(order.status)}`}
                          >
                            {order.statusLabel}
                          </span>
                        </td>
                        <td className="col-right space-x-2">
                          {order.status === 'draft' ? (
                            <button
                              type="button"
                              onClick={() => void validateOrder(order.id)}
                              className="text-sm font-medium text-primary-600 hover:underline"
                            >
                              Validate
                            </button>
                          ) : null}
                          {order.status === 'validated' ? (
                            <Link
                              href={`/dashboard/fleet/orders/${order.id}`}
                              className="text-sm font-medium text-primary-600 hover:underline"
                            >
                              Allocate
                            </Link>
                          ) : null}
                          {order.tripCount > 0 ? (
                            <Link
                              href="/dashboard/fleet/trips"
                              className="text-sm font-medium text-neutral-600 hover:underline"
                            >
                              {order.tripCount} trip{order.tripCount !== 1 ? 's' : ''}
                            </Link>
                          ) : null}
                        </td>
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
