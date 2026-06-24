import type { DemoPack, DemoPackId } from './types';
import { genericPack } from './generic/pack';

export type VerticalPackConfig = {
  id: DemoPackId;
  label: string;
  orgName: string;
  emailDomain: string;
  prefix: string;
  tagline: string;
  publicFooterText: string;
  departments: readonly string[];
  departmentMap: Record<string, string>;
  productName?: string;
  county?: string;
  postalAddress?: string;
  /** Single sign-in across all verticals in multi-context demo */
  unifiedDemoEmail?: string;
  unifiedDemoPassword?: string;
};

const UNIFIED_ADMIN_EMAIL = 'admin@imara.co.ke';

export function buildVerticalPackFromGeneric(config: VerticalPackConfig): DemoPack {
  const {
    id,
    label,
    orgName,
    emailDomain,
    prefix,
    tagline,
    publicFooterText,
    departments,
    departmentMap,
    productName = 'Stride',
    county = 'Nairobi',
    postalAddress = `${county}, Kenya`,
    unifiedDemoEmail = UNIFIED_ADMIN_EMAIL,
    unifiedDemoPassword = genericPack.demoPassword,
  } = config;

  const mapEmail = (email: string) =>
    email.replace(/@demo\.example\.com$/, `@${emailDomain}`);

  const employees = genericPack.employees.map((e) => ({
    ...e,
    employeeNumber: e.employeeNumber.replace(/^DMO/, prefix),
    idNumber: e.idNumber.replace(/^DMO/, prefix),
    kraPin: e.kraPin.replace(/DMO/g, prefix),
    nssfNumber: e.nssfNumber.replace(/^DMO/, prefix),
    nhifNumber: e.nhifNumber.replace(/^DMO/, prefix),
    email: mapEmail(e.email),
    department: departmentMap[e.department] ?? e.department,
    role: e.role
      .replace(/Demo Corp[^—]*/gi, orgName)
      .replace(/Kampala|Uganda/gi, 'Nairobi')
      .replace(/— Uganda/gi, '— Nairobi'),
  }));

  const u = genericPack.staffUsers;
  const roleEmails = Object.fromEntries(
    Object.entries(u.roleEmails).map(([k, v]) => [k, mapEmail(v as string)]),
  ) as typeof u.roleEmails;

  return {
    ...genericPack,
    id,
    label,
    workspace: {
      name: orgName,
      contactName: 'Grace Wanjiku',
      contactEmail: `hr@${emailDomain}`,
      contactPhone: '+254 709 880000',
      postalAddress,
      county,
      employeeNumberPrefix: prefix,
      payrollFrequency: 'monthly',
      leavePayMode: 'none',
    },
    recruitmentEmployer: orgName,
    entities: {
      ke: {
        code: 'ke',
        legalName: orgName,
        contactName: 'Grace Wanjiku',
        contactEmail: `hr@${emailDomain}`,
        contactPhone: '+254 709 880000',
        postalAddress,
        county: 'Kenya',
        employeeNumberPrefix: `${prefix}-KE`,
        currency: 'KES',
      },
      ug: {
        ...genericPack.entities.ug,
        legalName: `${orgName} — Regional Office`,
        contactEmail: `regional@${emailDomain}`,
        employeeNumberPrefix: `${prefix}-UG`,
      },
    },
    legacyWorkspaceNames: [orgName, ...genericPack.legacyWorkspaceNames],
    departments: [...departments],
    employees,
    careersJobs: genericPack.careersJobs.slice(0, 3).map((job, i) => ({
      ...job,
      location: 'Nairobi, Kenya',
      description: job.description.replace(/Demo Corporation|multi-country/gi, orgName),
      title:
        i === 0
          ? `${departments[0] ?? 'Operations'} Lead`
          : i === 1
            ? 'HR & Payroll Officer'
            : 'Finance Analyst',
    })),
    credentials: genericPack.credentials.map((c) => ({
      ...c,
      email: mapEmail(c.email),
    })),
    pipelineEmailDomain: `pipeline.${emailDomain}`,
    jobReferenceCode: prefix,
    slugToken: prefix.toLowerCase(),
    demoPassword: unifiedDemoPassword,
    staffUsers: {
      admin: { email: unifiedDemoEmail, name: 'Amina Njeri' },
      hr: { email: `hr@${emailDomain}`, name: u.hr.name },
      finance: { email: `finance@${emailDomain}`, name: u.finance.name },
      ess: { email: mapEmail(u.ess.email), name: u.ess.name },
      roleEmails,
    },
    interviewLocations: {
      video: 'https://meet.imara.co.ke/interview',
      onsite: `${orgName} — Head Office, Nairobi`,
    },
    companySetup: {
      appName: productName,
      orgName,
      tagline,
      wordmark: productName,
      contactEmail: 'hello@raventechgroup.com',
      contactPhone: '+254 709 880000',
      contactAddress: postalAddress,
      careersEmployerName: orgName,
      careersTagline: tagline,
      staffLoginWelcomeTitle: `Welcome to ${productName}`,
      staffLoginWelcomeSubtitle: `Sign in to manage ${orgName}`,
      essLoginWelcomeTitle: 'Employee Self Service',
      essLoginWelcomeSubtitle: 'Payslips, leave, and personal details',
      payslipLegalName: orgName,
      emailFromName: `${productName} — ${orgName}`,
      publicFooterText,
      documentFooterText: `${productName} · ${orgName} · Confidential`,
    },
  };
}

export { UNIFIED_ADMIN_EMAIL };
/** @deprecated use UNIFIED_ADMIN_EMAIL */
export const UNIFIED_DEMO_EMAIL = UNIFIED_ADMIN_EMAIL;
