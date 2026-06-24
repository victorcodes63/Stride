import { buildVerticalPackFromGeneric } from '../build-from-generic';
import { generateDemoStaffRows } from '../generate-demo-staff';

const departments = [
  'Clinical Services',
  'Nursing',
  'Pharmacy',
  'Laboratory',
  'Administration',
  'HR & Payroll',
] as const;

const base = buildVerticalPackFromGeneric({
  id: 'hospital-healthcare',
  label: 'Hospital & healthcare demo',
  orgName: 'Amani Medical Centre',
  emailDomain: 'amani.imara.co.ke',
  prefix: 'AMC',
  tagline: 'Clinical rota, credentials, and payroll for hospitals and healthcare providers.',
  publicFooterText:
    'Amani Medical Centre runs on Stride — shift scheduling, licence tracking, and NHIF-ready payroll for healthcare teams.',
  departments: [...departments],
  departmentMap: {
    Operations: 'Clinical Services',
    Sales: 'Administration',
    Logistics: 'Pharmacy',
    Finance: 'HR & Payroll',
    'Human Resources': 'HR & Payroll',
    ICT: 'Administration',
  },
  postalAddress: 'Ngong Road, Nairobi — 120-bed facility',
});

/** ~188 active staff — credible module-home headcount for marketing screenshots. */
const clinicalStaff = generateDemoStaffRows({
  prefix: 'AMC',
  emailDomain: 'amani.imara.co.ke',
  count: 178,
  departments,
  startIndex: 11,
  baseSalary: 72000,
});

export const hospitalHealthcarePack = {
  ...base,
  employees: [...base.employees, ...clinicalStaff],
};
