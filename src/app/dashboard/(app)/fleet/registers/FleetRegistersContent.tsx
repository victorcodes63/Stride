'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Users, Handshake, Fuel, Wrench } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import {
  FLEET_DRIVER_STATUS_LABELS,
  FLEET_MAINTENANCE_TYPE_LABELS,
  FLEET_MAINTENANCE_TYPES,
  fleetDriverStatusBadgeClass,
} from '@/lib/fleet/registers';

type Tab = 'drivers' | 'partners' | 'fuel' | 'maintenance';

type VehicleOption = { id: string; registration: string; label: string | null };

type DriverRow = {
  id: string;
  fullName: string;
  phone: string | null;
  licenceNumber: string | null;
  licenceClass: string | null;
  licenceExpiry: string | null;
  status: string;
  statusLabel: string;
  employeeName: string | null;
  tripCount: number;
};

type PartnerRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  tripCount: number;
};

type FuelRow = {
  id: string;
  vehicleRegistration: string;
  driverName: string | null;
  fueledAt: string;
  liters: number;
  amountKes: number;
  odometerKm: number | null;
  station: string | null;
};

type MaintenanceRow = {
  id: string;
  vehicleRegistration: string;
  maintenanceTypeLabel: string;
  description: string;
  performedAt: string;
  costKes: number | null;
  vendor: string | null;
};

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function FleetRegistersContent() {
  const [tab, setTab] = useState<Tab>('drivers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelRow[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceRow[]>([]);

  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicence, setDriverLicence] = useState('');

  const [partnerName, setPartnerName] = useState('');
  const [partnerContact, setPartnerContact] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');

  const [fuelVehicleId, setFuelVehicleId] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

  const [maintVehicleId, setMaintVehicleId] = useState('');
  const [maintType, setMaintType] = useState('service');
  const [maintDescription, setMaintDescription] = useState('');
  const [maintCost, setMaintCost] = useState('');
  const [maintVendor, setMaintVendor] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vehiclesRes, driversRes, partnersRes, fuelRes, maintRes] = await Promise.all([
        fetch('/api/fleet/vehicles'),
        fetch('/api/fleet/drivers'),
        fetch('/api/fleet/partners'),
        fetch('/api/fleet/fuel-logs'),
        fetch('/api/fleet/maintenance-logs'),
      ]);

      if (!vehiclesRes.ok || !driversRes.ok || !partnersRes.ok || !fuelRes.ok || !maintRes.ok) {
        throw new Error('Unable to load fleet registers.');
      }

      const vehicleRows = (await vehiclesRes.json()) as VehicleOption[];
      setVehicles(vehicleRows);
      setDrivers((await driversRes.json()) as DriverRow[]);
      setPartners((await partnersRes.json()) as PartnerRow[]);
      setFuelLogs((await fuelRes.json()) as FuelRow[]);
      setMaintenanceLogs((await maintRes.json()) as MaintenanceRow[]);

      setFuelVehicleId((prev) => prev || vehicleRows[0]?.id || '');
      setMaintVehicleId((prev) => prev || vehicleRows[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load fleet registers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitDriver(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/fleet/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: driverName,
          phone: driverPhone,
          licenceNumber: driverLicence,
        }),
      });
      if (!res.ok) throw new Error('Failed to add driver.');
      setDriverName('');
      setDriverPhone('');
      setDriverLicence('');
      setShowDriverForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add driver.');
    } finally {
      setSaving(false);
    }
  }

  async function submitPartner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/fleet/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerName,
          contactName: partnerContact,
          contactPhone: partnerPhone,
        }),
      });
      if (!res.ok) throw new Error('Failed to add partner.');
      setPartnerName('');
      setPartnerContact('');
      setPartnerPhone('');
      setShowPartnerForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add partner.');
    } finally {
      setSaving(false);
    }
  }

  async function submitFuel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/fleet/fuel-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: fuelVehicleId,
          liters: Number(fuelLiters),
          amountKes: Number(fuelAmount),
          station: fuelStation,
          odometerKm: fuelOdometer ? Number(fuelOdometer) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to log fuel.');
      setFuelLiters('');
      setFuelAmount('');
      setFuelStation('');
      setFuelOdometer('');
      setShowFuelForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log fuel.');
    } finally {
      setSaving(false);
    }
  }

  async function submitMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/fleet/maintenance-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: maintVehicleId,
          maintenanceType: maintType,
          description: maintDescription,
          costKes: maintCost ? Number(maintCost) : undefined,
          vendor: maintVendor,
        }),
      });
      if (!res.ok) throw new Error('Failed to log maintenance.');
      setMaintDescription('');
      setMaintCost('');
      setMaintVendor('');
      setShowMaintenanceForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log maintenance.');
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'drivers', label: 'Drivers', icon: Users },
    { key: 'partners', label: 'Partners', icon: Handshake },
    { key: 'fuel', label: 'Fuel logs', icon: Fuel },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Registers & logs"
        description="Driver and transport partner registers, plus fuel and maintenance history per vehicle."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === key
                ? 'bg-[var(--dash-accent)] text-white'
                : 'bg-[var(--dash-surface)] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      {!loading && tab === 'drivers' ? (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowDriverForm((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--dash-accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add driver
            </button>
          </div>
          {showDriverForm ? (
            <form onSubmit={submitDriver} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-3">
              <input className="dash-auth-input" placeholder="Full name" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
              <input className="dash-auth-input" placeholder="Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
              <input className="dash-auth-input" placeholder="Licence number" value={driverLicence} onChange={(e) => setDriverLicence(e.target.value)} />
              <button type="submit" disabled={saving} className="dash-auth-submit sm:col-span-3">
                {saving ? 'Saving…' : 'Save driver'}
              </button>
            </form>
          ) : null}
          <DashboardTableCard>
            <DashboardTableViewport>
              {drivers.length === 0 ? (
                <DashboardTableEmpty title="No drivers" description="Add drivers or run fleet demo seed." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Licence</th>
                      <th>Status</th>
                      <th>Employee link</th>
                      <th className="col-right">Trips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((row) => (
                      <tr key={row.id}>
                        <td className="col-primary font-medium">
                          {row.fullName}
                          {row.phone ? <span className="mt-0.5 block text-xs font-normal text-neutral-500">{row.phone}</span> : null}
                        </td>
                        <td>
                          {row.licenceNumber ?? '—'}
                          {row.licenceClass ? <span className="text-xs text-neutral-500"> ({row.licenceClass})</span> : null}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fleetDriverStatusBadgeClass(row.status as keyof typeof FLEET_DRIVER_STATUS_LABELS)}`}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td>{row.employeeName ?? '—'}</td>
                        <td className="col-right">{row.tripCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      ) : null}

      {!loading && tab === 'partners' ? (
        <>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setShowPartnerForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--dash-accent)] px-3 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Add partner
            </button>
          </div>
          {showPartnerForm ? (
            <form onSubmit={submitPartner} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-3">
              <input className="dash-auth-input" placeholder="Company name" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} required />
              <input className="dash-auth-input" placeholder="Contact name" value={partnerContact} onChange={(e) => setPartnerContact(e.target.value)} />
              <input className="dash-auth-input" placeholder="Contact phone" value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} />
              <button type="submit" disabled={saving} className="dash-auth-submit sm:col-span-3">{saving ? 'Saving…' : 'Save partner'}</button>
            </form>
          ) : null}
          <DashboardTableCard>
            <DashboardTableViewport>
              {partners.length === 0 ? (
                <DashboardTableEmpty title="No partners" description="Add outsourced transport partners." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Contact</th>
                      <th className="col-right">Trips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((row) => (
                      <tr key={row.id}>
                        <td className="col-primary font-medium">{row.name}</td>
                        <td>
                          {row.contactName ?? '—'}
                          {row.contactPhone ? <span className="mt-0.5 block text-xs text-neutral-500">{row.contactPhone}</span> : null}
                        </td>
                        <td className="col-right">{row.tripCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      ) : null}

      {!loading && tab === 'fuel' ? (
        <>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setShowFuelForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--dash-accent)] px-3 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Log fuel
            </button>
          </div>
          {showFuelForm ? (
            <form onSubmit={submitFuel} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-2">
              <select className="dash-auth-input" value={fuelVehicleId} onChange={(e) => setFuelVehicleId(e.target.value)} required>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration}{v.label ? ` — ${v.label}` : ''}</option>
                ))}
              </select>
              <input className="dash-auth-input" placeholder="Station" value={fuelStation} onChange={(e) => setFuelStation(e.target.value)} />
              <input className="dash-auth-input" type="number" step="0.01" placeholder="Litres" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} required />
              <input className="dash-auth-input" type="number" placeholder="Amount (KES)" value={fuelAmount} onChange={(e) => setFuelAmount(e.target.value)} required />
              <input className="dash-auth-input" type="number" placeholder="Odometer (km)" value={fuelOdometer} onChange={(e) => setFuelOdometer(e.target.value)} />
              <button type="submit" disabled={saving} className="dash-auth-submit sm:col-span-2">{saving ? 'Saving…' : 'Save fuel log'}</button>
            </form>
          ) : null}
          <DashboardTableCard>
            <DashboardTableViewport>
              {fuelLogs.length === 0 ? (
                <DashboardTableEmpty title="No fuel logs" description="Record diesel fills against vehicles." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th>Station</th>
                      <th className="col-right">Litres</th>
                      <th className="col-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelLogs.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.fueledAt)}</td>
                        <td className="col-primary font-medium">{row.vehicleRegistration}</td>
                        <td>{row.station ?? '—'}</td>
                        <td className="col-right">{row.liters.toLocaleString()}</td>
                        <td className="col-right">{formatKes(row.amountKes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      ) : null}

      {!loading && tab === 'maintenance' ? (
        <>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setShowMaintenanceForm((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--dash-accent)] px-3 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Log maintenance
            </button>
          </div>
          {showMaintenanceForm ? (
            <form onSubmit={submitMaintenance} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-2">
              <select className="dash-auth-input" value={maintVehicleId} onChange={(e) => setMaintVehicleId(e.target.value)} required>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration}{v.label ? ` — ${v.label}` : ''}</option>
                ))}
              </select>
              <select className="dash-auth-input" value={maintType} onChange={(e) => setMaintType(e.target.value)}>
                {FLEET_MAINTENANCE_TYPES.map((t) => (
                  <option key={t} value={t}>{FLEET_MAINTENANCE_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input className="dash-auth-input sm:col-span-2" placeholder="Description" value={maintDescription} onChange={(e) => setMaintDescription(e.target.value)} required />
              <input className="dash-auth-input" type="number" placeholder="Cost (KES)" value={maintCost} onChange={(e) => setMaintCost(e.target.value)} />
              <input className="dash-auth-input" placeholder="Vendor / workshop" value={maintVendor} onChange={(e) => setMaintVendor(e.target.value)} />
              <button type="submit" disabled={saving} className="dash-auth-submit sm:col-span-2">{saving ? 'Saving…' : 'Save maintenance log'}</button>
            </form>
          ) : null}
          <DashboardTableCard>
            <DashboardTableViewport>
              {maintenanceLogs.length === 0 ? (
                <DashboardTableEmpty title="No maintenance logs" description="Track services, repairs, and inspections." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th className="col-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceLogs.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.performedAt)}</td>
                        <td className="col-primary font-medium">{row.vehicleRegistration}</td>
                        <td>{row.maintenanceTypeLabel}</td>
                        <td>
                          {row.description}
                          {row.vendor ? <span className="mt-0.5 block text-xs text-neutral-500">{row.vendor}</span> : null}
                        </td>
                        <td className="col-right">{row.costKes != null ? formatKes(row.costKes) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      ) : null}
    </DashboardPage>
  );
}
