import { buildVerticalPackFromGeneric, UNIFIED_DEMO_EMAIL } from '../build-from-generic';
import { generateDemoStaffRows } from '../generate-demo-staff';

const SACCO_TAGLINE =
  'Member-trusted payroll and workforce operations — compliant, M-Pesa-native, board-ready.';

const SACCO_DEPARTMENTS = [
  'Member Services',
  'Credit & Loans',
  'Finance',
  'Operations',
  'ICT',
  'HR & Administration',
] as const;

const SACCO_ROLES = [
  'Member Services Officer',
  'Loans Officer',
  'Credit Analyst',
  'Teller',
  'Finance Assistant',
  'Operations Coordinator',
  'ICT Support Analyst',
  'HR Officer',
  'Compliance Officer',
  'Branch Supervisor',
] as const;

const base = buildVerticalPackFromGeneric({
  id: 'imara-sacco',
  label: 'Stride — SACCO beachhead demo',
  orgName: 'Heritage Members SACCO Ltd',
  emailDomain: 'heritage.imara.co.ke',
  prefix: 'HMS',
  tagline: SACCO_TAGLINE,
  publicFooterText:
    'Heritage Members SACCO Ltd runs on Stride — M-Pesa-native payroll, SASRA-ready compliance, and workforce operations in one platform.',
  departments: [...SACCO_DEPARTMENTS],
  departmentMap: {
    Operations: 'Operations',
    Sales: 'Member Services',
    Logistics: 'Operations',
    Finance: 'Finance',
    'Human Resources': 'HR & Administration',
    ICT: 'ICT',
  },
  postalAddress: 'Upper Hill, Nairobi — regulated SACCO operations',
  unifiedDemoEmail: UNIFIED_DEMO_EMAIL,
});

/** ~40 active staff — credible Kenyan SME / SACCO headcount for demo-ready walkthroughs. */
const saccoStaff = generateDemoStaffRows({
  prefix: 'HMS',
  emailDomain: 'heritage.imara.co.ke',
  count: 30,
  departments: SACCO_DEPARTMENTS,
  startIndex: 11,
  baseSalary: 62000,
  roles: SACCO_ROLES,
});

export const imaraSaccoPack = {
  ...base,
  employees: [...base.employees, ...saccoStaff],
};
