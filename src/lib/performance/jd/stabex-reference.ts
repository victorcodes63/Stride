/**
 * Stabex JD manual reference pack — 13 divisions, 83 role templates.
 * Structured for manual JD entry (no AI). Used by PERF-01 seed + library import.
 */
import type { BscPerspective } from '@prisma/client';

import type { JobDescriptionInput } from '@/lib/performance/jd/types';

export const STABEX_REFERENCE_PACK_NAME = 'Stabex International JD Manual';

export const STABEX_DIVISIONS = [
  'Executive & Board',
  'Head Office & Finance',
  'Human Resources',
  'Legal & Compliance',
  'Procurement & Supply Chain',
  'LPG Operations',
  'Retail & Fuel Stations',
  'Logistics & Fleet',
  'HSE & Compliance',
  'Engineering & Maintenance',
  'Information Technology',
  'Marketing & Customer Experience',
  'Corporate Affairs',
] as const;

type StabexRoleTemplate = {
  title: string;
  grade: string;
  division: (typeof STABEX_DIVISIONS)[number];
};

const ROLE_SUFFIXES = [
  'Manager',
  'Supervisor',
  'Coordinator',
  'Officer',
  'Analyst',
  'Specialist',
  'Technician',
  'Assistant',
  'Lead',
  'Executive',
] as const;

const DIVISION_ROLE_PREFIXES: Record<(typeof STABEX_DIVISIONS)[number], string[]> = {
  'Executive & Board': ['Chief Executive', 'Deputy CEO', 'Company Secretary', 'Board Liaison', 'Strategy', 'Internal Audit', 'Risk'],
  'Head Office & Finance': ['Finance', 'Accounts', 'Treasury', 'Tax', 'Budget', 'Credit Control', 'Pricing'],
  'Human Resources': ['HR Business Partner', 'Recruitment', 'Learning & Development', 'Compensation', 'Employee Relations', 'HR Operations'],
  'Legal & Compliance': ['Legal Counsel', 'Regulatory Affairs', 'Contract', 'Compliance', 'Company Registration', 'Intellectual Property'],
  'Procurement & Supply Chain': ['Procurement', 'Vendor Management', 'Inventory', 'Warehouse', 'Import Logistics', 'Category'],
  'LPG Operations': ['LPG Plant', 'Cylinder Exchange', 'Bulk Dispatch', 'Refilling', 'QA Inspector', 'LPG Sales', 'Plant Maintenance'],
  'Retail & Fuel Stations': ['Station Manager', 'Fuel Attendant', 'Shift Supervisor', 'Cashier', 'Forecourt', 'Retail Operations', 'Customer Service'],
  'Logistics & Fleet': ['Fleet Operations', 'Fuel Tanker Driver', 'LPG Delivery Driver', 'Dispatch', 'Route Planning', 'Fleet Maintenance', 'Inventory Controller'],
  'HSE & Compliance': ['HSE Officer', 'Environmental Compliance', 'Fire & Safety', 'Occupational Health', 'Incident Investigation', 'Safety Trainer', 'Permit to Work'],
  'Engineering & Maintenance': ['Maintenance Engineer', 'Electrical', 'Mechanical', 'Civil Works', 'Calibration', 'Projects Engineer', 'Asset Reliability'],
  'Information Technology': ['IT Manager', 'Systems Administrator', 'Network', 'Application Support', 'Cybersecurity', 'Data Analyst', 'Service Desk'],
  'Marketing & Customer Experience': ['Brand', 'Digital Marketing', 'Trade Marketing', 'Customer Experience', 'Loyalty Programme', 'Market Research', 'Corporate Communications'],
  'Corporate Affairs': ['Government Relations', 'Community Engagement', 'CSR', 'Stakeholder Relations', 'Public Affairs', 'Media Relations'],
};

function buildRoleList(): StabexRoleTemplate[] {
  const roles: StabexRoleTemplate[] = [];
  let gradeIndex = 0;
  const grades = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];

  for (const division of STABEX_DIVISIONS) {
    const prefixes = DIVISION_ROLE_PREFIXES[division];
    for (const prefix of prefixes) {
      if (roles.length >= 83) break;
      const suffix = ROLE_SUFFIXES[roles.length % ROLE_SUFFIXES.length];
      const title =
        prefix.includes('Manager') ||
        prefix.includes('Officer') ||
        prefix.includes('Driver') ||
        prefix.includes('Attendant') ||
        prefix.includes('CEO') ||
        prefix.includes('Counsel')
          ? prefix
          : `${prefix} ${suffix}`;
      roles.push({
        title,
        grade: grades[gradeIndex % grades.length],
        division,
      });
      gradeIndex += 1;
    }
  }

  while (roles.length < 83) {
    const division = STABEX_DIVISIONS[roles.length % STABEX_DIVISIONS.length];
    roles.push({
      title: `${division.split(' ')[0]} Support ${roles.length + 1}`,
      grade: grades[roles.length % grades.length],
      division,
    });
  }

  return roles.slice(0, 83);
}

export const STABEX_ROLE_TEMPLATES = buildRoleList();

const DEFAULT_KRA_SET: Array<{
  title: string;
  bscPerspective: BscPerspective;
  weightPercent: number;
  kpis: Array<{ name: string; targetValue: string; unit: string; weightPercent: number }>;
}> = [
  {
    title: 'Financial performance',
    bscPerspective: 'financial',
    weightPercent: 30,
    kpis: [
      { name: 'Budget variance', targetValue: '≤5', unit: '%', weightPercent: 50 },
      { name: 'Cost per unit', targetValue: 'Within target', unit: 'KES', weightPercent: 50 },
    ],
  },
  {
    title: 'Customer & stakeholder service',
    bscPerspective: 'customer',
    weightPercent: 25,
    kpis: [
      { name: 'Customer satisfaction score', targetValue: '≥4.0', unit: '/5', weightPercent: 50 },
      { name: 'Complaint resolution within SLA', targetValue: '≥95', unit: '%', weightPercent: 50 },
    ],
  },
  {
    title: 'Operational excellence',
    bscPerspective: 'internal_process',
    weightPercent: 25,
    kpis: [
      { name: 'Process compliance audits passed', targetValue: '100', unit: '%', weightPercent: 50 },
      { name: 'On-time task completion', targetValue: '≥90', unit: '%', weightPercent: 50 },
    ],
  },
  {
    title: 'Learning & capability',
    bscPerspective: 'learning_growth',
    weightPercent: 20,
    kpis: [
      { name: 'Mandatory training completed', targetValue: '100', unit: '%', weightPercent: 50 },
      { name: 'Competency uplift actions closed', targetValue: '≥80', unit: '%', weightPercent: 50 },
    ],
  },
];

const DEFAULT_COMPETENCIES = [
  { name: 'Integrity & safety mindset', requiredLevel: 4 },
  { name: 'Customer focus', requiredLevel: 3 },
  { name: 'Team collaboration', requiredLevel: 3 },
  { name: 'Results orientation', requiredLevel: 4 },
  { name: 'Communication', requiredLevel: 3 },
] as const;

export function buildStabexJobDescriptionInput(
  role: StabexRoleTemplate,
): JobDescriptionInput {
  return {
    title: role.title,
    grade: role.grade,
    isReferencePack: true,
    jobPurpose: `Deliver ${role.title} outcomes for Stabex International in ${role.division}, aligned to company strategy and statutory requirements for petroleum/LPG retail in Kenya and Uganda.`,
    keyActivities: `Plan and execute core ${role.title.toLowerCase()} duties; monitor KPIs; escalate risks; support cross-functional initiatives within ${role.division}.`,
    authorityScope: 'Authority as defined in the Stabex delegation of authority matrix for this grade.',
    workingConditions: 'Office and/or field/site as required; adherence to HSE standards for fuel/LPG operations.',
    qualifications: 'Relevant diploma/degree and professional certification where applicable; minimum 2–5 years experience in oil marketing or related sector.',
    relationships: `Reports to ${role.division} line manager; liaises with HSE, Finance, and Operations teams; external stakeholders per role.`,
    kras: DEFAULT_KRA_SET.map((kra, sortOrder) => ({
      title: kra.title,
      description: `${kra.title} for ${role.title}`,
      bscPerspective: kra.bscPerspective,
      weightPercent: kra.weightPercent,
      sortOrder,
      kpis: kra.kpis.map((kpi, kpiOrder) => ({
        name: kpi.name,
        description: `${kpi.name} target for ${role.title}`,
        targetValue: kpi.targetValue,
        unit: kpi.unit,
        weightPercent: kpi.weightPercent,
        sortOrder: kpiOrder,
      })),
    })),
    competencies: DEFAULT_COMPETENCIES.map((c, sortOrder) => ({
      name: c.name,
      description: `Required proficiency level ${c.requiredLevel} of 5`,
      requiredLevel: c.requiredLevel,
      sortOrder,
    })),
  };
}

export function allStabexJobDescriptionInputs(): JobDescriptionInput[] {
  return STABEX_ROLE_TEMPLATES.map((role) => buildStabexJobDescriptionInput(role));
}
