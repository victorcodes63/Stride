// Illustrative demo data for marketing mocks — not real figures.

export const DEMO_TENANT = {
  name: 'SwiftFreight East Africa',
  hq: 'Nairobi',
  region: 'East Africa',
  entityCount: 3,
  currency: 'KES',
} as const;

export const DEMO_STATUTORY = {
  tenantName: DEMO_TENANT.name,
  period: 'May 2026',
  employeeCount: 248,
  rows: [
    { label: 'PAYE', amount: 'KES 3,842,160', status: 'Filed' },
    { label: 'NSSF', amount: 'KES 1,860,000', status: 'Filed' },
    { label: 'SHIF', amount: 'KES 446,400', status: 'Filed' },
    { label: 'Housing Levy', amount: 'KES 372,000', status: 'Filed' },
  ],
} as const;

export const DEMO_CORE_STATS = {
  activeStaff: 248,
  activeStaffHint: 'Across 3 entities',
  onDutyToday: 214,
  onDutyHint: 'Clocked in',
  leavePending: 6,
  leaveHint: 'Awaiting approval',
  payrollDue: '4.2M',
  payrollHint: 'This cycle',
  compliance: '100%',
  complianceHint: 'KRA · NSSF · SHIF',
  modulesLive: 2,
  modulesHint: '6 modules live',
} as const;

export const DEMO_CORE_EMPLOYEES = [
  { name: 'Amina Hassan', role: 'Dispatch Lead' },
  { name: 'Brian Otieno', role: 'Driver' },
  { name: 'Faith Wanjiru', role: 'HR Officer' },
  { name: 'James Mwangi', role: 'Fleet Controller' },
  { name: 'Lucy Adhiambo', role: 'Accounts Clerk' },
] as const;

export type DemoFleetTrip = {
  ref: string;
  route: string;
  vehicle: string;
  driver: string;
  status: 'Planned' | 'In transit' | 'Delivered';
  active?: boolean;
};

export const DEMO_FLEET_TRIPS: DemoFleetTrip[] = [
  {
    ref: 'TRP-2841',
    route: 'Nairobi → Mombasa',
    vehicle: 'KDA 123A',
    driver: 'Brian Otieno',
    status: 'Planned',
  },
  {
    ref: 'TRP-2844',
    route: 'Nakuru → Kisumu',
    vehicle: 'KCA 482K',
    driver: 'Peter Kamau',
    status: 'Planned',
  },
  {
    ref: 'TRP-2836',
    route: 'Thika → Malaba',
    vehicle: 'KBY 903R',
    driver: 'Grace Wanjiku',
    status: 'In transit',
    active: true,
  },
  {
    ref: 'TRP-2838',
    route: 'Eldoret → Kitale',
    vehicle: 'KDG 119A',
    driver: 'David Ochieng',
    status: 'In transit',
  },
  {
    ref: 'TRP-2829',
    route: 'Nairobi CBD → JKIA',
    vehicle: 'KCF 771M',
    driver: 'Amina Hassan',
    status: 'Delivered',
  },
  {
    ref: 'TRP-2825',
    route: 'Mombasa → Voi',
    vehicle: 'KBB 204P',
    driver: 'Faith Wanjiru',
    status: 'Delivered',
  },
];

export const DEMO_SACCO_MEMBERS = {
  tenantName: 'Heritage Members SACCO Ltd',
  memberCount: 5120,
  rows: [
    { name: 'Mary Njoki', id: 'MBR-10482', shares: 'KES 248,500' },
    { name: 'John Mutua', id: 'MBR-08814', shares: 'KES 182,000' },
    { name: 'Esther Wambui', id: 'MBR-12003', shares: 'KES 315,750' },
    { name: 'Samuel Kiprop', id: 'MBR-09761', shares: 'KES 96,400' },
  ],
  dividendRun: { label: 'Q2 2026', status: 'Approved' },
} as const;

export const DEMO_HEALTHCARE_ROTA = {
  wards: ['ICU', 'Maternity', 'Paeds'],
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  assignments: [
    ['AM', 'PM', 'OFF', 'AM', 'PM'],
    ['PM', 'AM', 'AM', 'OFF', 'AM'],
    ['OFF', 'AM', 'PM', 'PM', 'OFF'],
  ] as const,
  staff: [
    { name: 'Dr. Anne Muthoni', ward: 'ICU' },
    { name: 'Nurse Peter Ouma', ward: 'Maternity' },
  ],
} as const;

export const DEMO_ENERGY_HSE = {
  entities: ['Kenya', 'Uganda'],
  activeEntity: 'Kenya',
  openCount: 2,
  closedCount: 14,
  incidents: [
    { id: 'INC-204', location: 'Nairobi depot', severity: 'Medium', status: 'Open' },
    { id: 'INC-198', location: 'Mombasa terminal', severity: 'Low', status: 'Open' },
  ],
} as const;

export const DEMO_CONSTRUCTION_SITES = {
  sites: [
    { name: 'Westlands Tower', foundation: 100, structure: 68, mep: 24 },
    { name: 'Thika Road Depot', foundation: 100, structure: 42, mep: 8 },
    { name: 'Mombasa Yard', foundation: 88, structure: 15, mep: 4 },
  ],
  plant: [
    { name: 'Excavator', utilisation: 92 },
    { name: 'Mixer', utilisation: 74 },
  ],
} as const;

export const DEMO_PLATFORM_OVERVIEW = {
  greetingName: 'Amina',
  greeting: 'Good afternoon, Amina',
  modules: [
    {
      id: 'finance',
      label: 'Finance',
      lines: ['12 unpaid invoices', '4 vendor bills due'],
      attention: 0,
    },
    {
      id: 'hr-payroll',
      label: 'HR & Payroll',
      lines: ['248 staff', '214 on duty today'],
      attention: 6,
    },
    {
      id: 'legal',
      label: 'Legal',
      lines: ['Credentials up to date', '2 contracts renewing'],
      attention: 0,
    },
    {
      id: 'procurement',
      label: 'Procurement',
      lines: ['3 PRs awaiting approval', 'Fleet spares LPO open'],
      attention: 3,
    },
    {
      id: 'admin',
      label: 'Admin',
      lines: ['6 active fleet trips', '248 assets tracked'],
      attention: 0,
    },
    {
      id: 'projects',
      label: 'Projects',
      lines: ['8 active workstreams', 'Westlands 68% complete'],
      attention: 0,
    },
  ],
  snapshot: [
    { label: 'HR & Payroll', value: '6', note: 'Leave awaiting approval', tone: 'amber' as const },
    { label: 'Finance', value: '12', note: 'Unpaid invoices', tone: 'amber' as const },
    { label: 'Procurement', value: '3', note: 'PRs awaiting approval', tone: 'violet' as const },
    { label: 'Legal', value: '2', note: 'Contracts renewing', tone: 'emerald' as const },
    { label: 'Projects', value: '8', note: 'Active workstreams', tone: 'violet' as const },
    { label: 'Admin & Ops', value: '6', note: 'Active fleet trips', tone: 'primary' as const },
  ],
  shortcuts: [
    { label: 'Finance', detail: 'Invoices & AP' },
    { label: 'Fleet trips', detail: 'Trip board' },
    { label: 'Payroll', detail: 'May 2026 run' },
  ],
} as const;
