'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { FleetOrderListRow } from '@/lib/fleet-orders-api';
import { fleetOrderStatusBadgeClass } from '@/lib/fleet-order-status';

type OrderDetail = FleetOrderListRow & {
  customer: { id: string; name: string; contactPhone: string | null };
  trips: { id: string; tripNumber: string; status: string }[];
  notes: string | null;
};

type Vehicle = { id: string; registration: string; label: string | null; status: string };
type Driver = { id: string; fullName: string; status: string };
type Partner = { id: string; name: string };

export default function FleetOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [mode, setMode] = useState<'managed' | 'outsourced'>('managed');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [partnerId, setPartnerId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderRes, vehiclesRes, driversRes, partnersRes] = await Promise.all([
        fetch(`/api/fleet/orders/${orderId}`),
        fetch('/api/fleet/vehicles'),
        fetch('/api/fleet/drivers'),
        fetch('/api/fleet/partners'),
      ]);
      if (!orderRes.ok) throw new Error('Order not found.');
      setOrder((await orderRes.json()) as OrderDetail);
      if (vehiclesRes.ok) setVehicles((await vehiclesRes.json()) as Vehicle[]);
      if (driversRes.ok) setDrivers((await driversRes.json()) as Driver[]);
      if (partnersRes.ok) setPartners((await partnersRes.json()) as Partner[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function validateOrder() {
    const res = await fetch(`/api/fleet/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate' }),
    });
    if (res.ok) await load();
  }

  async function schedulePlannedTrip() {
    setAllocating(true);
    setAllocError(null);
    try {
      const res = await fetch(`/api/fleet/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_trip' }),
      });
      const data = (await res.json()) as { tripId?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to schedule trip.');
      if (data.tripId) window.location.href = `/dashboard/fleet/trips/${data.tripId}`;
    } catch (e) {
      setAllocError(e instanceof Error ? e.message : 'Failed to schedule trip.');
    } finally {
      setAllocating(false);
    }
  }

  async function allocate() {
    setAllocating(true);
    setAllocError(null);
    try {
      const res = await fetch(`/api/fleet/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'allocate',
          isOutsourced: mode === 'outsourced',
          vehicleId: mode === 'managed' ? vehicleId || undefined : undefined,
          driverId: mode === 'managed' ? driverId || undefined : undefined,
          partnerId: mode === 'outsourced' ? partnerId || undefined : partnerId || undefined,
        }),
      });
      const data = (await res.json()) as { tripId?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Allocation failed.');
      if (data.tripId) window.location.href = `/dashboard/fleet/trips/${data.tripId}`;
    } catch (e) {
      setAllocError(e instanceof Error ? e.message : 'Allocation failed.');
    } finally {
      setAllocating(false);
    }
  }

  const pageStatus = loading ? 'loading' : error ? 'error' : !order ? 'empty' : 'success';
  const canAllocate = order?.status === 'validated';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title={order?.orderNumber ?? 'Order'}
        description={order ? `${order.pickupLocation} → ${order.deliveryLocation}` : 'Order detail and allocation.'}
        actions={
          <Link href="/dashboard/fleet/orders" className="text-sm font-medium text-primary-600 hover:underline">
            Back to orders
          </Link>
        }
      />

      <DashboardAsyncState
        status={pageStatus}
        error={error}
        onRetry={() => void load()}
        empty={<p className="text-sm text-neutral-500">Order not found.</p>}
        loading={<DashboardPageSkeleton variant="detail" />}
      >
        {order ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-xl border border-neutral-200 bg-white p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${fleetOrderStatusBadgeClass(order.status)}`}
                >
                  {order.statusLabel}
                </span>
              </div>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Customer</dt>
                  <dd className="mt-1 text-sm text-ink">{order.customer.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Cargo</dt>
                  <dd className="mt-1 text-sm text-ink">{order.cargoType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Delivery deadline</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {order.deliveryDeadlineAt
                      ? new Date(order.deliveryDeadlineAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Trips</dt>
                  <dd className="mt-1 text-sm text-ink">{order.tripCount}</dd>
                </div>
              </dl>
              {order.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => void validateOrder()}
                  className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Validate order
                </button>
              ) : null}
              {order.status === 'validated' && order.tripCount === 0 ? (
                <button
                  type="button"
                  disabled={allocating}
                  onClick={() => void schedulePlannedTrip()}
                  className="mt-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100 disabled:opacity-50"
                >
                  Schedule trip (Planned)
                </button>
              ) : null}
            </section>

            <aside className="rounded-xl border border-neutral-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-ink">Allocate trip</h2>
              <p className="mt-2 text-xs text-neutral-500">
                Assign managed fleet (vehicle + driver) or an outsourced transport partner.
              </p>
              {!canAllocate ? (
                <p className="mt-4 text-sm text-neutral-500">Validate the order before allocating.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {allocError ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{allocError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('managed')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === 'managed' ? 'border-primary-500 bg-primary-50 font-medium' : 'border-neutral-200'}`}
                    >
                      Managed fleet
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('outsourced')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === 'outsourced' ? 'border-primary-500 bg-primary-50 font-medium' : 'border-neutral-200'}`}
                    >
                      Partner
                    </button>
                  </div>
                  {mode === 'managed' ? (
                    <>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium text-neutral-700">Vehicle</span>
                        <select
                          value={vehicleId}
                          onChange={(e) => setVehicleId(e.target.value)}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select vehicle…</option>
                          {vehicles
                            .filter((v) => v.status === 'available')
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.registration} {v.label ? `(${v.label})` : ''}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium text-neutral-700">Driver</span>
                        <select
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select driver…</option>
                          {drivers
                            .filter((d) => d.status === 'available')
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-neutral-700">Transport partner</span>
                      <select
                        required
                        value={partnerId}
                        onChange={(e) => setPartnerId(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select partner…</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={allocating}
                    onClick={() => void allocate()}
                    className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {allocating ? 'Allocating…' : 'Allocate & create trip'}
                  </button>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
