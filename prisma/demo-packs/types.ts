import type {
  CredentialCategory,
  CredentialStatus,
} from '@prisma/client';

export type DemoWorkspace = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  postalAddress: string;
  county: string;
  employeeNumberPrefix: string;
  payrollFrequency: string;
  leavePayMode: string;
};

export type DemoEntity = {
  code: 'ke' | 'ug';
  legalName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  postalAddress: string;
  county: string;
  employeeNumberPrefix: string;
  currency: 'KES' | 'UGX';
};

export type DemoEmployeeSeed = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  idNumber: string;
  kraPin: string;
  nssfNumber: string;
  nhifNumber: string;
  dateOfJoining: Date;
  baseSalary: number;
  allowances: Array<{ name: string; amount: number }>;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
};

export type DemoCareerJobSeed = {
  title: string;
  location: string;
  type: string;
  category: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  skills: string[];
  salary: { min: number; max: number; currency: string };
  salaryPublic: boolean;
  experience: string;
  education: string;
  minYearsExperience: number;
  educationLevel: string;
  educationQualification: string;
  requiredCertifications: string | null;
  deadlineDaysFromNow: number;
};

export type DemoCredentialSeed = {
  email: string;
  category: CredentialCategory;
  name: string;
  number: string;
  authority: string;
  issue: Date;
  expiry: Date;
  status: CredentialStatus;
};

export type DemoRoleEmails = {
  brian: string;
  grace: string;
  aisha: string;
  robert: string;
  james: string;
  paul: string;
  moses: string;
  harriet: string;
  kevin: string;
  diana: string;
};

export type DemoStaffUsers = {
  admin: { email: string; name: string };
  hr: { email: string; name: string };
  finance: { email: string; name: string };
  ess: { email: string; name: string };
  roleEmails: DemoRoleEmails;
};

export type DemoCompanySetup = {
  appName?: string;
  orgName?: string;
  tagline?: string;
  wordmark?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  careersEmployerName?: string;
  careersTagline?: string;
  staffLoginWelcomeTitle?: string;
  staffLoginWelcomeSubtitle?: string;
  essLoginWelcomeTitle?: string;
  essLoginWelcomeSubtitle?: string;
  payslipLegalName?: string;
  emailFromName?: string;
  publicFooterText?: string;
  documentFooterText?: string;
};

export type DemoPack = {
  id: string;
  label: string;
  workspace: DemoWorkspace;
  recruitmentEmployer: string;
  entities: { ke: DemoEntity; ug: DemoEntity };
  legacyWorkspaceNames: string[];
  departments: readonly string[];
  employees: DemoEmployeeSeed[];
  careersJobs: DemoCareerJobSeed[];
  credentials: DemoCredentialSeed[];
  pipelineEmailDomain: string;
  jobReferenceCode: string;
  slugToken: string;
  demoPassword: string;
  staffUsers: DemoStaffUsers;
  interviewLocations: {
    video: string;
    onsite: string;
  };
  /** Job title substring used to attach interview schedule break demo row. */
  interviewBreakJobTitleIncludes: string;
  /** Branding and public copy — seeded to Admin → Company setup. */
  companySetup: DemoCompanySetup;
};

export type DemoPackId =
  | 'generic'
  | 'petroleum-retail'
  | 'imara-sacco'
  | 'cargo-logistics'
  | 'hospital-healthcare'
  | 'travel-agency';

/** Packs shown in the multi-vertical entity switcher (excludes neutral generic shell). */
export const VERTICAL_SHOWCASE_PACK_IDS = [
  'imara-sacco',
  'petroleum-retail',
  'cargo-logistics',
  'hospital-healthcare',
  'travel-agency',
] as const satisfies readonly DemoPackId[];

export type VerticalShowcasePackId = (typeof VERTICAL_SHOWCASE_PACK_IDS)[number];
