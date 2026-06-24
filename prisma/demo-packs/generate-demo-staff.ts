import type { DemoEmployeeSeed } from './types';
import { d } from './date-helpers';

const FIRST_NAMES = [
  'Grace', 'James', 'Mary', 'Peter', 'Faith', 'Samuel', 'Lucy', 'Daniel', 'Esther', 'Michael',
  'Ann', 'Joseph', 'Ruth', 'David', 'Joy', 'Paul', 'Mercy', 'John', 'Catherine', 'Stephen',
  'Naomi', 'Brian', 'Hannah', 'Kevin', 'Sarah', 'Moses', 'Diana', 'Robert', 'Amina', 'Victor',
] as const;

const LAST_NAMES = [
  'Wanjiku', 'Ochieng', 'Akinyi', 'Mwangi', 'Njeri', 'Kamau', 'Achieng', 'Mutua', 'Wambui', 'Kipchoge',
  'Odhiambo', 'Njoroge', 'Chebet', 'Kimani', 'Wanjala', 'Barasa', 'Mutiso', 'Kariuki', 'Adhiambo', 'Rotich',
] as const;

const ROLES = [
  'Registered Nurse',
  'Clinical Officer',
  'Pharmacy Technician',
  'Lab Technologist',
  'Records Clerk',
  'Accounts Assistant',
  'HR Officer',
  'Support Staff',
  'Radiographer',
  'Theatre Nurse',
] as const;

type GenerateDemoStaffOptions = {
  prefix: string;
  emailDomain: string;
  count: number;
  departments: readonly string[];
  startIndex?: number;
  baseSalary?: number;
};

/** Synthetic workforce rows for vertical demos that need credible headcount KPIs. */
export function generateDemoStaffRows(options: GenerateDemoStaffOptions): DemoEmployeeSeed[] {
  const {
    prefix,
    emailDomain,
    count,
    departments,
    startIndex = 11,
    baseSalary = 68000,
  } = options;

  const rows: DemoEmployeeSeed[] = [];

  for (let i = 0; i < count; i++) {
    const n = startIndex + i;
    const num = String(n).padStart(3, '0');
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length]!;
    const department = departments[i % departments.length]!;
    const role = ROLES[i % ROLES.length]!;
    const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '');

    rows.push({
      employeeNumber: `${prefix}-KE-${num}`,
      firstName,
      lastName,
      role: `${role} — ${department}`,
      department,
      email: `${slug}.${num}@${emailDomain}`,
      phone: `+254 7${String(10 + (i % 89)).padStart(2, '0')} ${String(100000 + i).slice(0, 6)}`,
      idNumber: `${prefix}-EMP-${num}`,
      kraPin: `A${num}${prefix}K`,
      nssfNumber: `${prefix}-NSSF-${num}`,
      nhifNumber: `${prefix}-NHIF-${num}`,
      dateOfJoining: d(2021 + (i % 4), 1 + (i % 12), 1 + (i % 28)),
      baseSalary: baseSalary + (i % 9) * 3500,
      allowances: [{ name: 'Shift allowance', amount: 4000 + (i % 5) * 500 }],
      bankName: 'Equity Bank',
      bankBranch: 'Nairobi',
      bankAccountNumber: `${1000000000 + n}`,
    });
  }

  return rows;
}
