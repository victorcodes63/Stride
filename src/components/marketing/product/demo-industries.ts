/**
 * Demo records for the industry-pack previews. Same rules as demo-tenant.ts:
 * statuses and counts only, no money, invented names for a fictional company.
 */
import type { FleetTripListRow } from '@/lib/fleet-api';
import type { ApplicationListItem } from '@/types/dashboard';
import type { SaccoMemberRow } from '@/components/sacco/SaccoMemberRegister';
import type { ClinicalRotaAssignment, ClinicalRotaWard } from '@/components/healthcare/ClinicalRotaGrid';
import type { EnergyHseRollupRow } from '@/components/energy/EnergyHseRollupTable';
import type { ConstructionSiteRow } from '@/components/construction/ConstructionSiteTable';

const NOW = '2026-10-05T08:00:00.000Z';

function trip(
  id: string,
  tripNumber: string,
  status: FleetTripListRow['status'],
  statusLabel: string,
  origin: string,
  destination: string,
  customerName: string,
  vehicleRegistration: string,
  driverName: string,
): FleetTripListRow {
  return {
    id,
    tripNumber,
    status,
    statusLabel,
    origin,
    destination,
    cargoType: null,
    customerName,
    vehicleRegistration,
    driverName,
    partnerName: null,
    isOutsourced: false,
    plannedDeliveryAt: null,
    updatedAt: NOW,
  };
}

export const DEMO_FLEET_TRIPS: FleetTripListRow[] = [
  trip('t1', 'TRP-2841', 'planned', 'Planned', 'Nairobi', 'Mombasa', 'Amani Grain Co.', 'KDA 123A', 'Brian Otieno'),
  trip('t2', 'TRP-2844', 'planned', 'Planned', 'Nakuru', 'Kisumu', 'Lakeside Beverages', 'KCA 482K', 'Peter Kamau'),
  trip('t3', 'TRP-2836', 'in_transit', 'In transit', 'Thika', 'Malaba', 'Highland Cement', 'KBY 903R', 'Grace Wanjiku'),
  trip('t4', 'TRP-2838', 'in_transit', 'In transit', 'Eldoret', 'Kitale', 'Amani Grain Co.', 'KDG 119A', 'David Kiprono'),
  trip('t5', 'TRP-2829', 'delivered', 'Delivered', 'Nairobi CBD', 'JKIA', 'Coastline Freight', 'KCF 771M', 'Amina Hassan'),
  trip('t6', 'TRP-2825', 'delivered', 'Delivered', 'Mombasa', 'Voi', 'Lakeside Beverages', 'KBB 204P', 'Faith Wanjiru'),
];

export const DEMO_FLEET_COLUMNS: FleetTripListRow['status'][] = ['planned', 'in_transit', 'delivered'];

export const DEMO_SACCO_MEMBERS: SaccoMemberRow[] = [
  { id: 'm1', memberNumber: 'MBR-00412', fullName: 'Mary Njoki', status: 'active', joinedAt: '2019-03-14', balances: { shares: 0, bosa: 0, fosa: 0 } },
  { id: 'm2', memberNumber: 'MBR-00518', fullName: 'John Mutua', status: 'active', joinedAt: '2020-07-02', balances: { shares: 0, bosa: 0, fosa: 0 } },
  { id: 'm3', memberNumber: 'MBR-00733', fullName: 'Esther Wambui', status: 'active', joinedAt: '2021-11-23', balances: { shares: 0, bosa: 0, fosa: 0 } },
  { id: 'm4', memberNumber: 'MBR-00894', fullName: 'Samuel Kiprop', status: 'dormant', joinedAt: '2022-05-09', balances: { shares: 0, bosa: 0, fosa: 0 } },
  { id: 'm5', memberNumber: 'MBR-01027', fullName: 'Lucy Achieng', status: 'active', joinedAt: '2024-01-17', balances: { shares: 0, bosa: 0, fosa: 0 } },
  { id: 'm6', memberNumber: 'MBR-01102', fullName: 'Kevin Odhiambo', status: 'active', joinedAt: '2025-08-30', balances: { shares: 0, bosa: 0, fosa: 0 } },
];

export const DEMO_ROTA_WEEK_START = '2026-10-05';

export const DEMO_ROTA_WARDS: ClinicalRotaWard[] = [
  { code: 'ICU', name: 'Intensive care' },
  { code: 'MAT', name: 'Maternity' },
  { code: 'PAED', name: 'Paediatrics' },
];

function shift(id: string, wardCode: string, day: number, employeeName: string, clinicalRole: string, licenseOk = true): ClinicalRotaAssignment {
  const date = new Date(`${DEMO_ROTA_WEEK_START}T12:00:00`);
  date.setDate(date.getDate() + day);
  const workDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    id,
    wardCode,
    employeeName,
    clinicalRole,
    workDate,
    licenseOk,
    licenseWarnings: licenseOk ? [] : ['Practising licence expires before shift'],
  };
}

export const DEMO_ROTA_ASSIGNMENTS: ClinicalRotaAssignment[] = [
  shift('r1', 'ICU', 0, 'Anne Muthoni', 'medical_officer'),
  shift('r2', 'ICU', 1, 'Peter Ouma', 'nurse'),
  shift('r3', 'ICU', 2, 'Anne Muthoni', 'medical_officer'),
  shift('r4', 'ICU', 3, 'Joy Chebet', 'nurse', false),
  shift('r5', 'ICU', 4, 'Peter Ouma', 'nurse'),
  shift('r6', 'MAT', 0, 'Joy Chebet', 'nurse'),
  shift('r7', 'MAT', 1, 'Mercy Atieno', 'clinical_officer'),
  shift('r8', 'MAT', 3, 'Mercy Atieno', 'clinical_officer'),
  shift('r9', 'MAT', 4, 'Joy Chebet', 'nurse'),
  shift('r10', 'PAED', 1, 'Daniel Kiptoo', 'medical_officer'),
  shift('r11', 'PAED', 2, 'Ruth Nyambura', 'nurse'),
  shift('r12', 'PAED', 4, 'Daniel Kiptoo', 'medical_officer'),
];

function application(
  id: string,
  firstName: string,
  lastName: string,
  status: ApplicationListItem['status'],
  title: string,
  daysAgo: number,
  viewedByMe = true,
): ApplicationListItem {
  const applied = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id,
    jobId: `job-${title}`,
    candidateId: `cand-${id}`,
    status,
    appliedDate: applied,
    resumePath: null,
    viewedByMe,
    candidate: { id: `cand-${id}`, firstName, lastName, email: '', resumePath: null },
    job: { id: `job-${title}`, title, company: 'Client: Amani Grain Co.', location: 'Nairobi', clientName: 'Amani Grain Co.' },
  } as ApplicationListItem;
}

export const DEMO_APPLICATIONS: ApplicationListItem[] = [
  application('a1', 'Faith', 'Wairimu', 'pending', 'HR Analyst', 0, false),
  application('a2', 'Brian', 'Ochieng', 'pending', 'Payroll Officer', 1, false),
  application('a3', 'Lucy', 'Akinyi', 'reviewed', 'HR Analyst', 2),
  application('a4', 'James', 'Mwangi', 'reviewed', 'Operations Manager', 3),
  application('a5', 'Grace', 'Njeri', 'shortlisted', 'Payroll Officer', 4),
  application('a6', 'Tom', 'Kariuki', 'hired', 'Recruiter', 9),
];

export const DEMO_ENERGY_ROLLUP: EnergyHseRollupRow[] = [
  { entityLabel: 'Downstream KE', clientName: 'Retail stations', siteCount: 14, openIncidents: 2, highSeverity: 0, permitsExpiring: 3 },
  { entityLabel: 'Terminals KE', clientName: 'Depot operations', siteCount: 3, openIncidents: 1, highSeverity: 1, permitsExpiring: 0 },
  { entityLabel: 'Downstream UG', clientName: 'Retail stations', siteCount: 6, openIncidents: 0, highSeverity: 0, permitsExpiring: 1 },
  { entityLabel: 'Logistics JV', clientName: 'Fuel haulage', siteCount: 2, openIncidents: 1, highSeverity: 0, permitsExpiring: 0 },
];

export const DEMO_CONSTRUCTION_SITES: ConstructionSiteRow[] = [
  { id: 's1', code: 'WT-01', name: 'Westlands Tower', status: 'active', parentSiteCode: null, projectCode: 'PRJ-104', childCount: 2 },
  { id: 's2', code: 'WT-01A', name: 'Foundation & basement', status: 'completed', parentSiteCode: 'WT-01', projectCode: 'PRJ-104', childCount: 0 },
  { id: 's3', code: 'WT-01B', name: 'Superstructure', status: 'active', parentSiteCode: 'WT-01', projectCode: 'PRJ-104', childCount: 0 },
  { id: 's4', code: 'TR-02', name: 'Thika Road Depot', status: 'active', parentSiteCode: null, projectCode: 'PRJ-117', childCount: 1 },
  { id: 's5', code: 'TR-02A', name: 'Warehouse shell', status: 'planning', parentSiteCode: 'TR-02', projectCode: 'PRJ-117', childCount: 0 },
  { id: 's6', code: 'KS-03', name: 'Kisumu Clinic Wing', status: 'suspended', parentSiteCode: null, projectCode: 'PRJ-121', childCount: 0 },
];
