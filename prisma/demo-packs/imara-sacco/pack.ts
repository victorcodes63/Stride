import { buildVerticalPackFromGeneric, UNIFIED_DEMO_EMAIL } from '../build-from-generic';

const SACCO_TAGLINE =
  'Member-trusted payroll and workforce operations — compliant, M-Pesa-native, board-ready.';

export const imaraSaccoPack = buildVerticalPackFromGeneric({
  id: 'imara-sacco',
  label: 'Stride — SACCO beachhead demo',
  orgName: 'Heritage Members SACCO Ltd',
  emailDomain: 'heritage.imara.co.ke',
  prefix: 'HMS',
  tagline: SACCO_TAGLINE,
  publicFooterText:
    'Heritage Members SACCO Ltd runs on Stride — M-Pesa-native payroll, SASRA-ready compliance, and workforce operations in one platform.',
  departments: [
    'Member Services',
    'Credit & Loans',
    'Finance',
    'Operations',
    'ICT',
    'HR & Administration',
  ],
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
