'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
  dashboardTableSelectClass,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { stationBelongsToEntity, type EntityId } from '@/lib/entityConfig';
import { toast } from '@/components/ui/toast';

type IncidentType =
 | 'Hazardous Material'
 | 'Fire/Explosion Risk'
 | 'Personal Injury'
 | 'Near Miss'
 | 'Equipment Failure';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type IncidentStatus = 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';

type IncidentRow = {
 ref: string;
 date: string;
 station: string;
 type: IncidentType;
 severity: Severity;
 reportedBy: string;
 status: IncidentStatus;
 description: string;
};

const SITES = [
 'Kampala Office',
 'Nairobi Office',
 'Mombasa Site',
 'Jinja Site',
 'Nakuru Warehouse',
 'Entebbe Hub',
] as const;

const DEMO_INCIDENTS: IncidentRow[] = [
 {
 ref: 'INC-2025-001',
 date: '2026-05-01T06:40:00',
 station: 'Mombasa Site',
 type: 'Equipment Failure',
 severity: 'High',
 reportedBy: 'Shift Lead — A. Otieno',
 status: 'Open',
 description: 'Minor fluid leak near loading bay — area cordoned and cleaned.',
 },
 {
 ref: 'INC-2025-002',
 date: '2026-04-28T14:15:00',
 station: 'Kampala Office',
 type: 'Near Miss',
 severity: 'Medium',
 reportedBy: 'Operations Associate — J. Okello',
 status: 'Under Investigation',
 description: 'Forklift reversed without spotter; flow stopped before contact.',
 },
 {
 ref: 'INC-2025-003',
 date: '2026-04-22T09:05:00',
 station: 'Entebbe Hub',
 type: 'Personal Injury',
 severity: 'Critical',
 reportedBy: 'Site Supervisor — M. Namukasa',
 status: 'Under Investigation',
 description: 'Slip on wet loading pad; ankle sprain; first aid administered.',
 },
 {
 ref: 'INC-2025-004',
 date: '2026-04-18T22:30:00',
 station: 'Nairobi Office',
 type: 'Fire/Explosion Risk',
 severity: 'High',
 reportedBy: 'Night Lead — P. Wanjala',
 status: 'Resolved',
 description: 'Electrical spark at distribution panel; power isolated and inspected.',
 },
 {
 ref: 'INC-2025-005',
 date: '2026-04-10T11:20:00',
 station: 'Jinja Site',
 type: 'Equipment Failure',
 severity: 'Low',
 reportedBy: 'Maintenance — R. Ssemwogerere',
 status: 'Closed',
 description: 'Conveyor sensor drift; recalibrated; no downtime beyond 20 minutes.',
 },
 {
 ref: 'INC-2025-006',
 date: '2026-04-02T07:55:00',
 station: 'Nakuru Warehouse',
 type: 'Hazardous Material',
 severity: 'Medium',
 reportedBy: 'Loader — D. Mutai',
 status: 'Open',
 description: 'Spill tray overflow during peak goods-in window.',
 },
];

function severityBadge(sev: Severity) {
 switch (sev) {
 case 'Critical':
 return 'bg-red-100 text-red-800';
 case 'High':
 return 'bg-orange-100 text-orange-800';
 case 'Medium':
 return 'bg-primary-100 text-primary-800';
 default:
 return 'bg-neutral-100 text-neutral-600';
 }
}

function statusBadge(st: IncidentStatus) {
 switch (st) {
 case 'Open':
 return 'bg-red-100 text-red-800';
 case 'Under Investigation':
 return 'bg-primary-100 text-primary-800';
 case 'Resolved':
 return 'bg-green-100 text-green-800';
 default:
 return 'bg-neutral-100 text-neutral-600';
 }
}

const PHANTOM_SITE = {
 ug: 'Entebbe Distribution Hub',
 ke: 'Kisumu Regional Hub',
} as const;

const INCIDENT_TYPES: IncidentType[] = [
 'Hazardous Material',
 'Fire/Explosion Risk',
 'Personal Injury',
 'Near Miss',
 'Equipment Failure',
];

const SEVERITY_LEVELS: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

export default function HseIncidentsPage() {
 const { activeEntity } = useEntity();
 const entityId = activeEntity.id as EntityId;

 const [stationFilter, setStationFilter] = useState('');
 const [logOpen, setLogOpen] = useState(false);
 const [detailRow, setDetailRow] = useState<IncidentRow | null>(null);

 const stationsForEntity = useMemo(
 () => SITES.filter((s) => stationBelongsToEntity(s, entityId)),
 [entityId],
 );

 const incidentsForEntity = useMemo(
 () => DEMO_INCIDENTS.filter((r) => stationBelongsToEntity(r.station, entityId)),
 [entityId],
 );

 const [logForm, setLogForm] = useState({
 station: SITES[0] as string,
 type: 'Hazardous Material' as IncidentType,
 severity: 'Medium' as Severity,
 datetime: '2026-05-05T10:00',
 description: '',
 injuredParty: '',
 immediateAction: '',
 });

 useEffect(() => {
 const first = stationsForEntity[0] ?? SITES[0];
 setLogForm((f) => ({
 ...f,
 station: (stationsForEntity as readonly string[]).includes(f.station) ? f.station : first,
 }));
 }, [entityId, stationsForEntity]);

 useEffect(() => {
 if (!stationFilter) return;
 if (stationFilter === PHANTOM_SITE[entityId]) return;
 if (!stationsForEntity.includes(stationFilter as (typeof SITES)[number])) setStationFilter('');
 }, [entityId, stationFilter, stationsForEntity]);

 const stationFilterOptions = useMemo(
 () => [...stationsForEntity, PHANTOM_SITE[entityId]] as string[],
 [entityId, stationsForEntity],
 );

 const filtered = useMemo(() => {
 if (!stationFilter) return incidentsForEntity;
 if (stationFilter === PHANTOM_SITE[entityId]) return [];
 return incidentsForEntity.filter((r) => r.station === stationFilter);
 }, [stationFilter, incidentsForEntity, entityId]);

 const openIncidents = incidentsForEntity.filter((r) => r.status === 'Open').length;
 const followUpCount = incidentsForEntity.filter((r) => r.status === 'Open' || r.status === 'Under Investigation').length;
 const resolvedThisMonth = incidentsForEntity.filter((r) => r.status === 'Resolved' || r.status === 'Closed').length;
 const nearMisses = incidentsForEntity.filter((r) => r.type === 'Near Miss').length;
 const daysSince = useMemo(() => {
 if (incidentsForEntity.length === 0) return '—';
 const latest = incidentsForEntity.reduce(
 (max, r) => (new Date(r.date).getTime() > new Date(max).getTime() ? r.date : max),
 incidentsForEntity[0].date,
 );
 const days = Math.floor((Date.now() - new Date(latest).getTime()) / (86400 * 1000));
 return Math.max(0, days);
 }, [incidentsForEntity]);

 const submitLog = (e: React.FormEvent) => {
 e.preventDefault();
 setLogOpen(false);
 setLogForm((f) => ({
 ...f,
 description: '',
 injuredParty: '',
 immediateAction: '',
 }));
 toast.success('Incident logged. Ref #INC-2025-007 assigned.');
 };

 const openModal = () => {
 const first = stationsForEntity[0] ?? SITES[0];
 setLogForm((f) => ({ ...f, station: first }));
 setLogOpen(true);
 };

 const listStatus = useMemo(() => {
 if (filtered.length === 0) return 'empty' as const;
 return 'success' as const;
 }, [filtered.length]);

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="HSE & Incident Management"
 description="Log, track, and resolve safety incidents across sites."
 actions={
 <button
 type="button"
 className="inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
 onClick={openModal}
 >
 Log Incident
 </button>
 }
 />

 <EntityContextBanner />

 <div className="rounded-lg border border-primary-200/70 bg-primary-50 px-4 py-3 text-sm text-primary-900 shadow-sm">
 <span className="font-medium">
 {followUpCount} incident{followUpCount === 1 ? '' : 's'} require follow-up action
 </span>
 {' · '}
 <a href="#incidents-table" className="font-semibold text-primary-800 underline decoration-primary-400 underline-offset-2 hover:text-primary-900">
 View Open Incidents
 </a>
 </div>

 <DashboardStatGrid>
 <DashboardStatCard label="Open incidents" value={openIncidents} tone="warning" warn={openIncidents > 0} />
 <DashboardStatCard label="Resolved this month" value={resolvedThisMonth} tone="success" />
 <DashboardStatCard label="Near misses logged" value={nearMisses} tone="violet" />
 <DashboardStatCard label="Days since last incident" value={daysSince} tone="primary" />
 </DashboardStatGrid>

 <div id="incidents-table" className="scroll-mt-6">
 <DashboardTableCard>
 <DashboardTableToolbar label={null}>
 <div>
 <label htmlFor="hse-station-filter" className="mr-2 text-sm text-neutral-600">
 Site
 </label>
 <select
 id="hse-station-filter"
 value={stationFilter}
 onChange={(e) => setStationFilter(e.target.value)}
 className={dashboardTableSelectClass}
 >
 <option key="all" value="">
  All sites
 </option>
 {stationFilterOptions.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 </div>
 </DashboardTableToolbar>

 <DashboardAsyncState
 status={listStatus}
 empty={
 <DashboardTableEmpty
 icon={<Shield className="h-8 w-8 text-neutral-300" aria-hidden />}
 title="No incidents found"
 description="All clear for this period."
 />
 }
 >
 <DashboardTableViewport minWidth={1000}>
 <DashboardTable>
 <thead>
 <tr>
 <th>Ref #</th>
 <th className="col-center">Date</th>
 <th>Site</th>
 <th>Type</th>
 <th className="col-center">Severity</th>
 <th>Reported By</th>
 <th className="col-center">Status</th>
 <th className="col-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((row) => (
 <tr key={row.ref}>
 <td className="font-medium text-neutral-900">{row.ref}</td>
 <td className="col-center tabular-nums">{new Date(row.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
 <td>{row.station}</td>
 <td>{row.type}</td>
 <td className="col-center">
 <span className={`badge-status ${severityBadge(row.severity)}`}>{row.severity}</span>
 </td>
 <td>{row.reportedBy}</td>
 <td className="col-center">
 <span className={`badge-status ${statusBadge(row.status)}`}>{row.status}</span>
 </td>
 <td className="col-right">
 <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setDetailRow(row)}>
 View Details
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </DashboardTable>
 </DashboardTableViewport>
 </DashboardAsyncState>
 </DashboardTableCard>
 </div>

 {logOpen && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="hse-log-title"
 onClick={() => setLogOpen(false)}
 >
 <div
 className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl md:max-w-xl md:p-8"
 onClick={(e) => e.stopPropagation()}
 >
 <h3 id="hse-log-title" className="text-lg font-semibold text-primary-900">
 Log incident
 </h3>
 <form className="mt-6 space-y-4" onSubmit={submitLog}>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Site</label>
 <select
 required
 value={logForm.station}
 onChange={(e) => setLogForm((f) => ({ ...f, station: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 >
 {stationsForEntity.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Incident type</label>
 <select
 required
 value={logForm.type}
 onChange={(e) => setLogForm((f) => ({ ...f, type: e.target.value as IncidentType }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 >
 {INCIDENT_TYPES.map((type) => (
 <option key={type} value={type}>
 {type}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Severity</label>
 <select
 required
 value={logForm.severity}
 onChange={(e) => setLogForm((f) => ({ ...f, severity: e.target.value as Severity }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 >
 {SEVERITY_LEVELS.map((level) => (
 <option key={level} value={level}>
 {level}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Date &amp; time</label>
 <input
 type="datetime-local"
 required
 value={logForm.datetime}
 onChange={(e) => setLogForm((f) => ({ ...f, datetime: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 />
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
 <textarea
 required
 rows={4}
 value={logForm.description}
 onChange={(e) => setLogForm((f) => ({ ...f, description: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 placeholder="What happened, where on site, materials or equipment involved…"
 />
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Injured party (optional)</label>
 <input
 value={logForm.injuredParty}
 onChange={(e) => setLogForm((f) => ({ ...f, injuredParty: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 placeholder="Name or role if applicable"
 />
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Immediate action taken</label>
 <textarea
 required
 rows={3}
 value={logForm.immediateAction}
 onChange={(e) => setLogForm((f) => ({ ...f, immediateAction: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 placeholder="Isolation, barriers, first aid, supervisor notified…"
 />
 </div>
 <div className="flex flex-wrap gap-3 pt-2">
 <button type="button" className="btn-secondary" onClick={() => setLogOpen(false)}>
 Cancel
 </button>
 <button type="submit" className="rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
 Submit
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {detailRow && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="hse-detail-title"
 onClick={() => setDetailRow(null)}
 >
 <div
 className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl md:p-8"
 onClick={(e) => e.stopPropagation()}
 >
 <h3 id="hse-detail-title" className="text-lg font-semibold text-primary-900">
 {detailRow.ref}
 </h3>
 <dl className="mt-4 space-y-2 text-sm">
 <div className="flex justify-between gap-4 border-b border-neutral-100 py-2">
 <dt className="text-neutral-500">Site</dt>
 <dd className="font-medium text-neutral-900">{detailRow.station}</dd>
 </div>
 <div className="flex justify-between gap-4 border-b border-neutral-100 py-2">
 <dt className="text-neutral-500">Type</dt>
 <dd className="text-neutral-800">{detailRow.type}</dd>
 </div>
 <div className="flex justify-between gap-4 border-b border-neutral-100 py-2">
 <dt className="text-neutral-500">Severity</dt>
 <dd>
 <span className={`badge-status ${severityBadge(detailRow.severity)}`}>{detailRow.severity}</span>
 </dd>
 </div>
 <div className="flex justify-between gap-4 border-b border-neutral-100 py-2">
 <dt className="text-neutral-500">Status</dt>
 <dd>
 <span className={`badge-status ${statusBadge(detailRow.status)}`}>{detailRow.status}</span>
 </dd>
 </div>
 <div className="py-2">
 <dt className="text-neutral-500">Description</dt>
 <dd className="mt-1 text-neutral-800">{detailRow.description}</dd>
 </div>
 </dl>
 <button type="button" className="btn-secondary mt-6" onClick={() => setDetailRow(null)}>
 Close
 </button>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
