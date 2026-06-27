import {
  PrismaClient,
  Prisma,
  CredentialCategory,
  CredentialStatus,
  AttendanceSummaryStatus,
  AttendanceExceptionType,
  AttendanceExceptionStatus,
  PayrollStatus,
  LeaveStatus,
  AttendancePolicyMode,
  LeaveAccrualMode,
  UserRole,
  StaffUserType,
  EssPortalRole,
  ApplicationStatus,
  InterviewStatus,
  ConfirmationStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { loadDemoPack } from './demo-packs/load-pack';
import { buildCompanySetupFromPack } from './demo-packs/build-company-setup';
import { companySetupKeyForContext, demoEntitySlug } from '../src/lib/demo-entity-slug';
import { d, daysFromToday } from './demo-packs/date-helpers';
import { calculateStatutoryForPayroll } from '../src/lib/payroll-calc';
import { ensureUniqueSlug, jobSlugBase } from '../src/lib/slug';

const basePrisma = new PrismaClient();
type PrismaCompatClient = PrismaClient & Record<string, unknown>;

/** Set in main() before any tenant-scoped seed writes. */
let demoOrganizationId = '';

const NON_TENANT_MODELS = new Set([
  'User',
  'Organization',
  'SchedulerLock',
  'PermissionDefinition',
  'CountryConfig',
  'RolePermission',
]);

function injectOrgId<T extends Record<string, unknown>>(data: T): T {
  if (!demoOrganizationId) return data;
  if (data.organizationId) return data;
  return { ...data, organizationId: demoOrganizationId };
}

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      create({ model, args, query }) {
        if (!NON_TENANT_MODELS.has(model)) {
          args.data = injectOrgId(args.data as Record<string, unknown>);
        }
        return query(args);
      },
      upsert({ model, args, query }) {
        if (!NON_TENANT_MODELS.has(model) && args.create) {
          args.create = injectOrgId(args.create as Record<string, unknown>);
        }
        return query(args);
      },
      createMany({ model, args, query }) {
        if (!NON_TENANT_MODELS.has(model) && Array.isArray(args.data)) {
          args.data = args.data.map((row) => injectOrgId(row as Record<string, unknown>));
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;

const prismaCompat = prisma as PrismaCompatClient;
const PASSWORD_ROUNDS = 10;

type CompatibilityItem = {
  key: string;
  available: boolean;
  reasonIfSkipped: string;
};

const pack = loadDemoPack();

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await basePrisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function ensureDemoOrganization(): Promise<string> {
  const hasOrgTable = await tableExists('Organization');
  if (!hasOrgTable) {
    console.log('→ Tenancy tables not present; seeding without organization scope.');
    return '';
  }

  const slug = `demo-${pack.id}`;
  const org = await basePrisma.organization.upsert({
    where: { slug },
    update: {
      name: pack.workspace.name,
      updatedAt: new Date(),
    },
    create: {
      name: pack.workspace.name,
      slug,
      country: 'KE',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
      updatedAt: new Date(),
    },
  });
  return org.id;
}

async function ensureStaffOrgMembership(userId: string, role: UserRole) {
  if (!demoOrganizationId) return;
  await basePrisma.organizationMembership.upsert({
    where: {
      userId_organizationId: { userId, organizationId: demoOrganizationId },
    },
    update: { role, updatedAt: new Date() },
    create: {
      userId,
      organizationId: demoOrganizationId,
      role,
      updatedAt: new Date(),
    },
  });
}

async function seedPackCompanySetup() {
  const setup = buildCompanySetupFromPack(pack);
  const key = companySetupKeyForContext(pack.id);
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: setup as unknown as Prisma.InputJsonValue },
    create: {
      key,
      value: setup as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`→ Company setup seeded for ${setup.orgName} [${key}]`);
}

const kenyanHolidays = [
  { name: "New Year's Day", recurDay: 1, recurMonth: 1, recurring: true },
  { name: 'Labour Day', recurDay: 1, recurMonth: 5, recurring: true },
  { name: 'Madaraka Day', recurDay: 1, recurMonth: 6, recurring: true },
  { name: 'Mashujaa Day', recurDay: 20, recurMonth: 10, recurring: true },
  { name: 'Jamhuri Day', recurDay: 12, recurMonth: 12, recurring: true },
  { name: 'Christmas Day', recurDay: 25, recurMonth: 12, recurring: true },
  { name: 'Boxing Day', recurDay: 26, recurMonth: 12, recurring: true },
  { name: 'Good Friday', date: '2026-04-03', recurring: false },
  { name: 'Easter Monday', date: '2026-04-06', recurring: false },
  { name: 'Eid ul-Fitr', date: '2026-03-20', recurring: false },
  { name: 'Eid ul-Adha', date: '2026-05-27', recurring: false },
  { name: 'Utamaduni Day', recurDay: 10, recurMonth: 10, recurring: true },
];

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function atUtc(dateYmd: string, hhmm: string): Date {
  return new Date(`${dateYmd}T${hhmm}:00.000Z`);
}

async function getOrCreatePackRecruitmentClientId(): Promise<string> {
  const multi = process.env.DEMO_MULTI_CONTEXT === 'true';

  if (multi) {
    let client = await prisma.client.findFirst({
      where: { name: pack.recruitmentEmployer },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: pack.recruitmentEmployer,
          isAnonymous: false,
          contactName: pack.workspace.contactName,
          contactEmail: pack.workspace.contactEmail,
          contactPhone: pack.workspace.contactPhone,
        },
      });
    } else {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          contactName: pack.workspace.contactName,
          contactEmail: pack.workspace.contactEmail,
          contactPhone: pack.workspace.contactPhone,
        },
      });
    }
    return client.id;
  }

  let settings = await prisma.recruitmentSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    const client = await prisma.client.create({
      data: {
        name: pack.recruitmentEmployer,
        isAnonymous: false,
        contactName: pack.workspace.contactName,
        contactEmail: pack.workspace.contactEmail,
        contactPhone: pack.workspace.contactPhone,
      },
    });
    await prisma.recruitmentSettings.create({
      data: {
        id: 'default',
        employerName: pack.recruitmentEmployer,
        contactName: pack.workspace.contactName,
        contactEmail: pack.workspace.contactEmail,
        contactPhone: pack.workspace.contactPhone,
        linkedClientId: client.id,
      },
    });
    return client.id;
  }

  if (!settings.linkedClientId) {
    const client = await prisma.client.create({
      data: {
        name: pack.recruitmentEmployer,
        isAnonymous: false,
        contactName: pack.workspace.contactName,
        contactEmail: pack.workspace.contactEmail,
        contactPhone: pack.workspace.contactPhone,
      },
    });
    await prisma.recruitmentSettings.update({
      where: { id: 'default' },
      data: {
        employerName: pack.recruitmentEmployer,
        linkedClientId: client.id,
        contactName: pack.workspace.contactName,
        contactEmail: pack.workspace.contactEmail,
        contactPhone: pack.workspace.contactPhone,
      },
    });
    return client.id;
  }

  await prisma.client.update({
    where: { id: settings.linkedClientId },
    data: {
      name: pack.recruitmentEmployer,
      contactName: pack.workspace.contactName,
      contactEmail: pack.workspace.contactEmail,
      contactPhone: pack.workspace.contactPhone,
    },
  });
  await prisma.recruitmentSettings.update({
    where: { id: 'default' },
    data: {
      employerName: pack.recruitmentEmployer,
      contactName: pack.workspace.contactName,
      contactEmail: pack.workspace.contactEmail,
      contactPhone: pack.workspace.contactPhone,
    },
  });
  return settings.linkedClientId;
}

async function seedPackRecruitmentJobs(now: Date) {
  const clientId = await getOrCreatePackRecruitmentClientId();
  const year = now.getUTCFullYear();
  const referencePrefix = `JOB-${year}-${pack.jobReferenceCode}-`;

  await prisma.job.deleteMany({ where: { clientId } });

  // Clear stale jobs from prior reseeds (other recruitment clients / packs).
  await prisma.job.deleteMany({
    where: { referenceId: { startsWith: referencePrefix } },
  });

  for (let idx = 0; idx < pack.careersJobs.length; idx += 1) {
    const def = pack.careersJobs[idx];
    const referenceId = `${referencePrefix}${String(idx + 1).padStart(3, '0')}`;
    const slug = await ensureUniqueSlug(
      jobSlugBase(def.title, def.location, `${pack.slugToken}${idx}`),
      async (s) => !!(await prisma.job.findUnique({ where: { slug: s } })),
    );
    const applicationDeadline = daysFromToday(def.deadlineDaysFromNow);
    const postedDate = daysFromToday(-2 - idx * 2);

    await prisma.job.create({
      data: {
        referenceId,
        slug,
        title: def.title,
        company: pack.recruitmentEmployer,
        location: def.location,
        type: def.type,
        category: def.category,
        description: def.description,
        requirements: def.requirements as unknown as Prisma.JsonArray,
        responsibilities: def.responsibilities as unknown as Prisma.JsonArray,
        benefits: def.benefits as unknown as Prisma.JsonArray,
        salary: def.salary as Prisma.InputJsonValue,
        salaryPublic: def.salaryPublic,
        experience: def.experience,
        education: def.education,
        minYearsExperience: def.minYearsExperience,
        educationLevel: def.educationLevel,
        educationQualification: def.educationQualification,
        requiredCertifications: def.requiredCertifications,
        skills: def.skills as unknown as Prisma.JsonArray,
        isActive: true,
        postedDate,
        applicationStartAt: null,
        applicationDeadline,
        clientId,
        concealCompany: false,
      },
    });
  }

  console.log(
    `→ Careers: ${pack.careersJobs.length} job listings for ${pack.recruitmentEmployer} (deadlines ${Math.min(...pack.careersJobs.map((j) => j.deadlineDaysFromNow))}–${Math.max(...pack.careersJobs.map((j) => j.deadlineDaysFromNow))} days from seed run)`,
  );
}

async function seedPackRecruitmentAssessments(prismaCompat: PrismaCompatClient) {
  if (!prismaCompat.assessmentTemplate || !prismaCompat.jobAssessmentAssignment) return;

  const clientId = await getOrCreatePackRecruitmentClientId();
  if (!clientId) return;

  const firstJob = await prisma.job.findFirst({
    where: { clientId },
    orderBy: { postedDate: 'desc' },
    select: { id: true },
  });
  if (!firstJob) return;

  const templateId = `demo-assessment-${pack.id}`;
  const template = await prismaCompat.assessmentTemplate.upsert({
    where: { id: templateId },
    update: {
      name: 'HR & payroll fundamentals',
      description: 'Short screen for shortlisted candidates — auto-scored MCQ + numeric.',
      timeLimitMinutes: 20,
      isActive: true,
    },
    create: {
      id: templateId,
      name: 'HR & payroll fundamentals',
      description: 'Short screen for shortlisted candidates — auto-scored MCQ + numeric.',
      timeLimitMinutes: 20,
      isActive: true,
    },
  });
  await prismaCompat.assessmentQuestion.deleteMany({ where: { templateId: template.id } });
  await prismaCompat.assessmentQuestion.createMany({
    data: [
      {
        templateId: template.id,
        type: 'mcq',
        prompt: 'Which deduction is primarily used for Pay As You Earn in Kenya?',
        options: ['PAYE', 'VAT', 'WHT', 'NHIF'] as unknown as Prisma.JsonArray,
        correctAnswer: { value: 'PAYE' } as Prisma.InputJsonValue,
        maxPoints: 1,
        orderIndex: 0,
      },
      {
        templateId: template.id,
        type: 'numeric',
        prompt: 'Standard annual leave days commonly benchmarked for Kenyan employees?',
        correctAnswer: { value: 21 } as Prisma.InputJsonValue,
        maxPoints: 1,
        orderIndex: 1,
      },
    ],
  });
  await prismaCompat.jobAssessmentAssignment.upsert({
    where: { jobId_templateId: { jobId: firstJob.id, templateId: template.id } },
    update: { triggerStatus: null },
    create: {
      jobId: firstJob.id,
      templateId: template.id,
      triggerStatus: null,
    },
  });
  console.log(`→ Assessments: demo template linked to job ${firstJob.id.slice(0, 8)}…`);
}



function utcAtOffsetDaysHour(daysFromUtcToday: number, hourUtc: number, minuteUtc = 0): Date {
  const d = daysFromToday(daysFromUtcToday);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d;
}

/**
 * Candidates, applications, and interviews under the linked recruitment client.
 * Emails end with @{pack.pipelineEmailDomain}; re-seed clears prior demo rows via deleteMany.
 */
async function seedPackRecruitmentApplicationsAndInterviews() {
  const clientId = await getOrCreatePackRecruitmentClientId();
  if (!clientId) {
    console.log('→ Recruitment pipeline: skipped (no linked recruitment client).');
    return;
  }

  const removed = await prisma.candidate.deleteMany({
    where: { email: { endsWith: `@${pack.pipelineEmailDomain}` } },
  });
  if (removed.count > 0) {
    console.log(`→ Recruitment pipeline: removed ${removed.count} prior demo candidate(s).`);
  }

  const jobs = await prisma.job.findMany({
    where: { clientId },
    orderBy: [{ referenceId: 'asc' }],
    select: { id: true, title: true },
  });
  if (jobs.length === 0) {
    console.log('→ Recruitment pipeline: no jobs found for linked client.');
    return;
  }

  const jid = (i: number) => jobs[i % jobs.length]!.id;

  type FD = Record<string, unknown>;

  type Row = {
    slug: string;
    first: string;
    last: string;
    phone: string;
    loc: string;
    nationality: string;
    county: string;
    xp: number;
    jobIx: number;
    status: ApplicationStatus;
    daysAgo: number;
    salary: string;
    cover?: string;
    notes?: string;
    fd: FD;
    iv?: {
      /** days from UTC “today” (same helper as roster) */
      dayOffset: number;
      hourUtc: number;
      type: 'video' | 'phone' | 'onsite';
      duration: 30 | 45 | 60;
      status: InterviewStatus;
      inviteSent: boolean;
      confirm?: ConfirmationStatus;
    };
  };

  /** Mix of statuses, education levels, disciplines, certs, memberships, employer names — matches dashboard filter keys. */
  const rows: Row[] = [
    {
      slug: 'edith.nakitende',
      first: 'Edith',
      last: 'Nakitende',
      phone: '+256 700 310001',
      loc: 'Kampala, Uganda',
      nationality: 'Ugandan',
      county: 'Kampala',
      xp: 9,
      jobIx: 0,
      status: ApplicationStatus.shortlisted,
      daysAgo: 2,
      salary: 'UGX 3.8M–4.2M monthly',
      cover: 'Regional retail leadership across East Africa; comfortable with Nairobi–Kampala travel.',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'Strathmore University',
            grade: 'Distinction',
            discipline: 'MBA — Strategy',
          },
          { level: 'undergraduate', institution: 'Makerere University', grade: 'Upper Second', discipline: 'Commerce' },
        ],
        employmentHistory: [
          {
            jobTitle: 'Operations Manager',
            companyName: 'Summit Petroleum Retail Kenya',
            industry: 'Retail',
            employmentType: 'Full-time',
            startDate: '2016-06',
            endDate: '2019-12',
            isCurrentJob: false,
          },
          {
            jobTitle: 'Area Supervisor',
            companyName: 'BlueFlame Stations Uganda',
            industry: 'Energy',
            employmentType: 'Full-time',
            startDate: '2020-02',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'PMP' }],
        professionalMemberships: [{ name: 'East Africa Logistics Association', membershipNo: 'EALA-88421' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: 6,
        hourUtc: 8,
        type: 'video',
        duration: 45,
        status: InterviewStatus.scheduled,
        inviteSent: true,
        confirm: ConfirmationStatus.confirmed,
      },
    },
    {
      slug: 'amos.kiprop',
      first: 'Amos',
      last: 'Kiprop',
      phone: '+254 722 910402',
      loc: 'Nairobi, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 4,
      jobIx: 5,
      status: ApplicationStatus.shortlisted,
      daysAgo: 4,
      salary: 'KES 165k–210k',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'undergraduate',
            institution: 'JKUAT',
            grade: 'Second Class Upper',
            discipline: 'Environmental Science',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'HSE Advisor',
            companyName: 'Transline Logistics PLC',
            industry: 'Transport',
            employmentType: 'Full-time',
            startDate: '2021-04',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'NEBOSH IGC' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: 3,
        hourUtc: 13,
        type: 'onsite',
        duration: 60,
        status: InterviewStatus.scheduled,
        inviteSent: true,
        confirm: ConfirmationStatus.pending,
      },
    },
    {
      slug: 'stella.amani',
      first: 'Stella',
      last: 'Amani',
      phone: '+256 702 774102',
      loc: 'Jinja, Uganda',
      nationality: 'Ugandan',
      county: 'Jinja',
      xp: 6,
      jobIx: 2,
      status: ApplicationStatus.shortlisted,
      daysAgo: 3,
      salary: 'UGX 2.5M negotiable',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'undergraduate',
            institution: 'MUK',
            grade: 'Second Class Upper',
            discipline: 'Chemical Engineering',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Depot Superintendent',
            companyName: 'Great Lakes Bulk Fuels',
            industry: 'Logistics',
            employmentType: 'Full-time',
            startDate: '2019-07',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: -2,
        hourUtc: 7,
        type: 'phone',
        duration: 30,
        status: InterviewStatus.completed,
        inviteSent: true,
        confirm: ConfirmationStatus.confirmed,
      },
    },
    {
      slug: 'paul.mwendwa',
      first: 'Paul',
      last: 'Mwendwa',
      phone: '+254 733 661902',
      loc: 'Mombasa, Kenya',
      nationality: 'Kenyan',
      county: 'Mombasa',
      xp: 5,
      jobIx: 4,
      status: ApplicationStatus.shortlisted,
      daysAgo: 5,
      salary: 'KES 150k–180k plus OTE',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'undergraduate',
            institution: 'USIU-Africa',
            grade: 'First Class',
            discipline: 'Marketing',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'B2B Account Executive',
            companyName: 'Pacific Fleet Payments',
            industry: 'Payments',
            employmentType: 'Full-time',
            startDate: '2020-01',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: 8,
        hourUtc: 15,
        type: 'video',
        duration: 45,
        status: InterviewStatus.scheduled,
        inviteSent: false,
        confirm: ConfirmationStatus.pending,
      },
    },
    {
      slug: 'julian.akello',
      first: 'Julian',
      last: 'Akello',
      phone: '+256 775 902314',
      loc: 'Mbale, Uganda',
      nationality: 'Ugandan',
      county: 'Mbale',
      xp: 1,
      jobIx: 9,
      status: ApplicationStatus.pending,
      daysAgo: 1,
      salary: 'Open to graduate stipend programme',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'undergraduate',
            institution: 'Makerere University',
            grade: 'Second Class Upper',
            discipline: 'Economics',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Graduate Trainee — Analytics',
            companyName: 'TechBridge Uganda Ltd',
            industry: 'Technology',
            employmentType: 'Contract',
            startDate: '2025-09',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'nancy.waithira',
      first: 'Nancy',
      last: 'Waithira',
      phone: '+254 713 557720',
      loc: 'Kiambu, Kenya',
      nationality: 'Kenyan',
      county: 'Kiambu',
      xp: 3,
      jobIx: 7,
      status: ApplicationStatus.pending,
      daysAgo: 5,
      salary: 'KES 155k–200k',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'undergraduate',
            institution: 'University of Nairobi',
            grade: 'Second Class Upper',
            discipline: 'Computer Science',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'IT Support Analyst',
            companyName: 'Retail Systems East Africa',
            industry: 'Technology',
            employmentType: 'Full-time',
            startDate: '2022-01',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'peter.otim',
      first: 'Peter',
      last: 'Otim',
      phone: '+256 702 889011',
      loc: 'Arua, Uganda',
      nationality: 'Ugandan',
      county: 'Arua',
      xp: 4,
      jobIx: 3,
      status: ApplicationStatus.pending,
      daysAgo: 6,
      salary: 'UGX 2.1M negotiable',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'diploma',
            institution: 'Uganda Petroleum Institute',
            grade: 'Merit',
            discipline: 'Logistics',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Route Supervisor',
            companyName: 'GasLink Distribution',
            industry: 'Energy',
            employmentType: 'Full-time',
            startDate: '2022-03',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'james.odhiambo',
      first: 'James',
      last: 'Odhiambo',
      phone: '+254 721 904011',
      loc: 'Kisumu, Kenya',
      nationality: 'Kenyan',
      county: 'Kisumu',
      xp: 4,
      jobIx: 6,
      status: ApplicationStatus.reviewed,
      daysAgo: 8,
      salary: 'UGX / KES equivalence discussed at offer',
      notes: 'Strong ER examples; scheduling panel next week.',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'masters',
            institution: 'University of Nairobi',
            grade: 'Pass',
            discipline: 'Human Resource Management',
          },
          {
            level: 'undergraduate',
            institution: 'Maseno University',
            grade: 'Upper Second',
            discipline: 'Psychology',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Senior HR Officer',
            companyName: 'Eastlands Retail Cooperative',
            industry: 'Retail',
            employmentType: 'Full-time',
            startDate: '2018-06',
            endDate: '2025-01',
            isCurrentJob: false,
          },
        ],
        professionalMemberships: [{ name: 'IHRM Uganda', membershipNo: 'IHRM-45290' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: 12,
        hourUtc: 10,
        type: 'video',
        duration: 45,
        status: InterviewStatus.scheduled,
        inviteSent: true,
        confirm: ConfirmationStatus.confirmed,
      },
    },
    {
      slug: 'claire.mbatha',
      first: 'Claire',
      last: 'Mbatha',
      phone: '+254 722 600882',
      loc: 'Nairobi, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 3,
      jobIx: 8,
      status: ApplicationStatus.reviewed,
      daysAgo: 7,
      salary: 'KES 148k–195k',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'undergraduate',
            institution: 'Strathmore University',
            grade: 'Upper Second',
            discipline: 'Information Technology',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Junior Systems Analyst',
            companyName: 'Nairobi Convenience Systems',
            industry: 'Software',
            employmentType: 'Full-time',
            startDate: '2023-01',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'violet.namukasa',
      first: 'Violet',
      last: 'Namukasa',
      phone: '+256 772 661203',
      loc: 'Kampala, Uganda',
      nationality: 'Ugandan',
      county: 'Wakiso',
      xp: 5,
      jobIx: 1,
      status: ApplicationStatus.pending,
      daysAgo: 2,
      salary: 'UGX 2.2M monthly',
      cover: 'Forecourt supervisory experience across three high-volume Kampala outlets.',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'diploma',
            institution: 'Kyambogo University',
            grade: 'Credit',
            discipline: 'Business Management',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Senior Station Supervisor',
            companyName: 'MetroFuel Uganda',
            industry: 'Retail',
            employmentType: 'Full-time',
            startDate: '2019-04',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'simon.otieno',
      first: 'Simon',
      last: 'Otieno',
      phone: '+254 715 993044',
      loc: 'Westlands, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 4,
      jobIx: 6,
      status: ApplicationStatus.pending,
      daysAgo: 3,
      salary: 'KES 155k gross',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'undergraduate',
            institution: 'Kenyatta University',
            grade: 'Second Class Upper',
            discipline: 'Psychology',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'HR Coordinator',
            companyName: 'LogiChain Kenya Ltd',
            industry: 'Logistics',
            employmentType: 'Full-time',
            startDate: '2022-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'sarah.nakayi',
      first: 'Sarah',
      last: 'Nakayi',
      phone: '+256 701 774290',
      loc: 'Gulu, Uganda',
      nationality: 'Ugandan',
      county: 'Gulu',
      xp: 2,
      jobIx: 9,
      status: ApplicationStatus.pending,
      daysAgo: 4,
      salary: 'UGX 980k stipend expectation',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'certificate',
            institution: 'Uganda Martyrs Certificate College',
            grade: 'Pass',
            discipline: 'Marketing',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Volunteer Outreach Lead',
            companyName: 'North Uganda Youth Forum',
            industry: 'Community',
            employmentType: 'Freelance',
            startDate: '2024-01',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'ruth.chepkemei',
      first: 'Ruth',
      last: 'Chepkemei',
      phone: '+254 720 884102',
      loc: 'Kericho, Kenya',
      nationality: 'Kenyan',
      county: 'Kericho',
      xp: 2,
      jobIx: 5,
      status: ApplicationStatus.pending,
      daysAgo: 6,
      salary: 'KES 138k gross',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'certificate',
            institution: 'Boma Safety College',
            grade: 'Distinction',
            discipline: 'Occupational Safety',
          },
          { level: 'high_school', institution: 'Kericho Girls High', grade: 'B Plain' },
        ],
        employmentHistory: [
          {
            jobTitle: 'Safety Assistant',
            companyName: 'Highland Warehousing',
            industry: 'Industrial',
            employmentType: 'Contract',
            startDate: '2024-04',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'First Aid Instructor' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'david.bukenya',
      first: 'David',
      last: 'Bukenya',
      phone: '+256 772 993011',
      loc: 'Masaka, Uganda',
      nationality: 'Ugandan',
      county: 'Masaka',
      xp: 6,
      jobIx: 7,
      status: ApplicationStatus.pending,
      daysAgo: 9,
      salary: 'UGX 3.8M negotiating',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'masters',
            institution: 'Makerere University',
            grade: 'Merit',
            discipline: 'Information Systems',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'DevOps Technician',
            companyName: 'AgriFuel Systems',
            industry: 'Agriculture',
            employmentType: 'Full-time',
            startDate: '2019-07',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'beatrice.oloo',
      first: 'Beatrice',
      last: 'Oloo',
      phone: '+254 734 889103',
      loc: 'Kisumu, Kenya',
      nationality: 'Kenyan',
      county: 'Kisumu',
      xp: 5,
      jobIx: 7,
      status: ApplicationStatus.pending,
      daysAgo: 10,
      salary: 'KES 148k gross',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'KCA University',
            grade: 'Credit',
            discipline: 'Computer Science',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Systems Administrator',
            companyName: 'LakeHub Cooperative',
            industry: 'Finance',
            employmentType: 'Full-time',
            startDate: '2020-11',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'patrick.mugenyi',
      first: 'Patrick',
      last: 'Mugenyi',
      phone: '+256 703 774290',
      loc: 'Kampala, Uganda',
      nationality: 'Ugandan',
      county: 'Kampala',
      xp: 7,
      jobIx: 2,
      status: ApplicationStatus.pending,
      daysAgo: 11,
      salary: 'UGX 3.6M gross',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'masters',
            institution: 'ESAMI',
            grade: 'Pass',
            discipline: 'Supply Chain Management',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Warehouse Lead',
            companyName: 'FreshRoute Cold Chain Ltd',
            industry: 'Cold chain',
            employmentType: 'Full-time',
            startDate: '2017-06',
            endDate: '2026-03',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'Lean Six Sigma Green Belt' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'florence.makori',
      first: 'Florence',
      last: 'Makori',
      phone: '+254 722 330911',
      loc: 'Machakos, Kenya',
      nationality: 'Kenyan',
      county: 'Machakos',
      xp: 4,
      jobIx: 4,
      status: ApplicationStatus.hired,
      daysAgo: 28,
      salary: 'KES 148k negotiated',
      notes: 'Accepted offer — onboarding handoff to HRBP.',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'Daystar University',
            grade: 'Distinction',
            discipline: 'Business Administration',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Key Account Manager — Fleet',
            companyName: 'MetroLine Transport',
            industry: 'Transport',
            employmentType: 'Full-time',
            startDate: '2020-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'Salesforce Ranger' }],
        professionalMemberships: [{ name: 'MSK', membershipNo: 'MSK-10293' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
      iv: {
        dayOffset: -18,
        hourUtc: 9,
        type: 'onsite',
        duration: 45,
        status: InterviewStatus.completed,
        inviteSent: true,
        confirm: ConfirmationStatus.confirmed,
      },
    },
    {
      slug: 'moses.kansiime',
      first: 'Moses',
      last: 'Kansiime',
      phone: '+256 772 330011',
      loc: 'Hoima, Uganda',
      nationality: 'Ugandan',
      county: 'Hoima',
      xp: 5,
      jobIx: 1,
      status: ApplicationStatus.rejected,
      daysAgo: 14,
      salary: 'UGX 2.5M expectation',
      notes: 'Insufficient supervisory tenure for flagship city site.',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'high_school',
            institution: 'St. Andrews College',
            grade: 'Arts focus',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Pump Attendant Supervisor',
            companyName: 'QuickFill Uganda',
            industry: 'Retail',
            employmentType: 'Full-time',
            startDate: '2022-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'joseph.ruto',
      first: 'Joseph',
      last: 'Ruto',
      phone: '+254 734 993011',
      loc: 'Eldoret, Kenya',
      nationality: 'Kenyan',
      county: 'Uasin Gishu',
      xp: 2,
      jobIx: 0,
      status: ApplicationStatus.pending,
      daysAgo: 12,
      salary: 'KES 295k negotiating',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'masters',
            institution: 'University of Edinburgh',
            grade: 'Merit',
            discipline: 'Engineering Management',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Regional Sales Lead — East Africa',
            companyName: 'Horizon PetroServices',
            industry: 'Energy',
            employmentType: 'Freelance',
            startDate: '2025-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'CPA(K)' }],
        professionalMemberships: [{ name: 'ICPAK', membershipNo: 'ICPAK-DEMO-99301' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'mariamu.nabasirye',
      first: 'Mariamu',
      last: 'Nabasirye',
      phone: '+256 774 993011',
      loc: 'Kampala, Uganda',
      nationality: 'Ugandan',
      county: 'Kampala',
      xp: 4,
      jobIx: 4,
      status: ApplicationStatus.pending,
      daysAgo: 13,
      salary: 'UGX equivalent to KES 140k expectation',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'Manchester Business School Uganda Hub',
            grade: 'Pass',
            discipline: 'MBA — Marketing',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Channel Partner Manager',
            companyName: 'Summit Petro Retail Kenya',
            industry: 'Retail',
            employmentType: 'Freelance',
            startDate: '2026-03',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'Google Ads Search' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'diana.jepkorir',
      first: 'Diana',
      last: 'Jepkorir',
      phone: '+254 722 112903',
      loc: 'Nairobi, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 3,
      jobIx: 9,
      status: ApplicationStatus.pending,
      daysAgo: 14,
      salary: 'KES 75k trainee allowance',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'Technical University of Kenya',
            grade: 'Distinction',
            discipline: 'Data Science',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Graduate Intern — Analytics',
            companyName: 'CityPay Kenya',
            industry: 'Finance',
            employmentType: 'Contract',
            startDate: '2025-10',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'peter.akampurira',
      first: 'Peter',
      last: 'Akampurira',
      phone: '+256 774 884102',
      loc: 'Kabale, Uganda',
      nationality: 'Ugandan',
      county: 'Kabale',
      xp: 6,
      jobIx: 3,
      status: ApplicationStatus.pending,
      daysAgo: 15,
      salary: 'UGX 3.9M negotiating',
      fd: {
        gender: 'Male',
        education: [
          {
            level: 'masters',
            institution: 'Uganda Martyrs University',
            grade: 'Credit',
            discipline: 'Environmental Management',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Fleet Coordinator — LPG',
            companyName: 'GreenCylinder Uganda',
            industry: 'Energy',
            employmentType: 'Full-time',
            startDate: '2019-02',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'linda.otieno',
      first: 'Linda',
      last: 'Otieno',
      phone: '+254 722 993011',
      loc: 'Nairobi, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 2,
      jobIx: 6,
      status: ApplicationStatus.pending,
      daysAgo: 14,
      salary: 'KES 120k probation band',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'certificate',
            institution: 'College of HR Excellence',
            grade: 'Credit',
            discipline: 'Industrial Relations',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Recruitment Coordinator',
            companyName: 'Summit Petro Retail Kenya',
            industry: 'Retail',
            employmentType: 'Full-time',
            startDate: '2026-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'amina.kirabo',
      first: 'Amina',
      last: 'Kirabo',
      phone: '+256 702 993011',
      loc: 'Kampala, Uganda',
      nationality: 'Ugandan',
      county: 'Kampala',
      xp: 5,
      jobIx: 5,
      status: ApplicationStatus.pending,
      daysAgo: 16,
      salary: 'UGX negotiable aligned to HSE scales',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'masters',
            institution: 'Aga Khan University',
            grade: 'Distinction',
            discipline: 'Nursing Leadership',
          },
          {
            level: 'undergraduate',
            institution: 'MUK',
            grade: 'Second Class Upper',
            discipline: 'Nursing',
          },
        ],
        employmentHistory: [
          {
            jobTitle: 'Lead Nurse Clinician',
            companyName: 'Metro Medical Centre Kampala',
            industry: 'Healthcare',
            employmentType: 'Full-time',
            startDate: '2020-01',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'Advanced Cardiac Life Support' }],
        professionalMemberships: [{ name: 'UNMC', membershipNo: 'UNMC-N-99301' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'winnie.kabatesi',
      first: 'Winnie',
      last: 'Kabatesi',
      phone: '+256 772 440011',
      loc: 'Mbarara, Uganda',
      nationality: 'Ugandan',
      county: 'Mbarara',
      xp: 1,
      jobIx: 5,
      status: ApplicationStatus.pending,
      daysAgo: 17,
      salary: 'UGX stipend-aligned',
      fd: {
        gender: 'Female',
        education: [
          {
            level: 'certificate',
            institution: 'Mbarara Nursing School',
            grade: 'Pass',
            discipline: 'Nursing',
          },
          { level: 'high_school', institution: 'Ntare Girls', grade: 'B+' },
        ],
        employmentHistory: [
          {
            jobTitle: 'Community Health Volunteer',
            companyName: 'West Ankole Cooperative',
            industry: 'Healthcare',
            employmentType: 'Freelance',
            startDate: '2024-06',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        professionalCertificationsList: [{ name: 'Basic Life Support' }],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
    {
      slug: 'isaac.nyamai',
      first: 'Isaac',
      last: 'Nyamai',
      phone: '+254 722 440011',
      loc: 'Nairobi, Kenya',
      nationality: 'Kenyan',
      county: 'Nairobi',
      xp: 1,
      jobIx: 8,
      status: ApplicationStatus.pending,
      daysAgo: 17,
      salary: 'KES 155k probation',
      fd: {
        gender: 'Male',
        education: [{ level: 'phd', institution: 'MIT', grade: 'Ongoing research', discipline: 'Human–Computer Interaction' }],
        employmentHistory: [
          {
            jobTitle: 'Research Affiliate',
            companyName: 'Nairobi HCI Lab',
            industry: 'Academia',
            employmentType: 'Contract',
            startDate: '2025-12',
            endDate: '',
            isCurrentJob: true,
          },
        ],
        declarations: {
          accurate: true,
          dataProcessing: true,
          backgroundChecks: true,
          talentPool: true,
        },
      },
    },
  ];

  let interviewCount = 0;
  for (const r of rows) {
    const email = `${r.slug}@${pack.pipelineEmailDomain}`;
    const candidate = await prisma.candidate.create({
      data: {
        firstName: r.first,
        lastName: r.last,
        email,
        phone: r.phone,
        location: r.loc,
        nationality: r.nationality,
        homeCounty: r.county,
        experience: r.xp,
        education: 'Profile completed in structured application.',
        resumePath: '/uploads/resumes/amara_njoroge_cv.pdf',
      },
    });

    const appliedDate = daysFromToday(-r.daysAgo);
    const application = await prisma.application.create({
      data: {
        jobId: jid(r.jobIx),
        candidateId: candidate.id,
        status: r.status,
        appliedDate,
        coverLetter: r.cover ?? null,
        salaryExpectations: r.salary,
        notes: r.notes ?? null,
        formData: r.fd as Prisma.InputJsonValue,
        resumePath: '/uploads/resumes/amara_njoroge_cv.pdf',
      },
    });

    if (r.iv) {
      const scheduledAt = utcAtOffsetDaysHour(r.iv.dayOffset, r.iv.hourUtc);
      await prisma.interview.create({
        data: {
          applicationId: application.id,
          scheduledAt,
          durationMinutes: r.iv.duration,
          type: r.iv.type,
          locationOrLink:
            r.iv.type === 'video'
              ? pack.interviewLocations.video
              : r.iv.type === 'phone'
                ? `Phone: candidate ${r.phone}`
                : pack.interviewLocations.onsite,
          notes: 'Scheduled via demo seed.',
          status: r.iv.status,
          inviteSentAt: r.iv.inviteSent ? daysFromToday(-1) : null,
          confirmationStatus: r.iv.confirm ?? ConfirmationStatus.pending,
          confirmationAt: r.iv.confirm === ConfirmationStatus.confirmed ? daysFromToday(-1) : null,
        },
      });
      interviewCount += 1;
    }
  }

  for (const j of jobs) {
    const c = await prisma.application.count({ where: { jobId: j.id } });
    await prisma.job.update({ where: { id: j.id }, data: { applicationCount: c } });
  }

  const stationSupervisor = jobs.find((j) => j.title.includes(pack.interviewBreakJobTitleIncludes));
  if (stationSupervisor) {
    await prisma.interviewScheduleBreak.deleteMany({ where: { jobId: stationSupervisor.id } });
    await prisma.interviewScheduleBreak.create({
      data: {
        jobId: stationSupervisor.id,
        scheduledAt: utcAtOffsetDaysHour(4, 11, 30),
        durationMinutes: 45,
        label: 'Panel lunch — bookable gap',
        notes: 'Interview day buffer for back-to-back panel slots.',
      },
    });
  }

  console.log(
    `→ Recruitment pipeline: ${rows.length} applications (${interviewCount} interviews) across ${jobs.length} demo job(s). Talent pool populated with the same candidates.`,
  );
}

async function purgeStaleBrandAccounts() {
  const essDeleted = await prisma.essPortalUser.deleteMany({
    where: { email: { contains: 'stabexintl.com', mode: 'insensitive' } },
  });
  const staffDeleted = await prisma.user.deleteMany({
    where: { email: { contains: 'stabexintl.com', mode: 'insensitive' } },
  });
  if (essDeleted.count || staffDeleted.count) {
    console.log(
      `→ Removed stale petroleum demo accounts (ESS: ${essDeleted.count}, staff: ${staffDeleted.count}).`,
    );
  }

  if (process.env.DEMO_MULTI_CONTEXT !== 'true') {
    await prisma.systemSetting.deleteMany({
      where: { key: { startsWith: 'admin.company.setup:petroleum-retail' } },
    });
    await prisma.outsourcingClient.deleteMany({
      where: {
        OR: [
          { entityCode: { contains: 'petroleum-retail' } },
          { name: { contains: 'stabex', mode: 'insensitive' } },
        ],
      },
    });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  demoOrganizationId = await ensureDemoOrganization();
  console.log(`→ Demo organization ready (${demoOrganizationId})`);

  await purgeStaleBrandAccounts();

  await seedPackCompanySetup();

  const now = new Date();
  const todayYmd = isoDate(now);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const compatibility: CompatibilityItem[] = [];
  const hasModel = (name: string) => Boolean(prismaCompat[name]);

  const marchYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const aprilYear = marchYear;

  const keSlug = demoEntitySlug(pack.id, 'ke');
  const ugSlug = demoEntitySlug(pack.id, 'ug');
  const skipOperatingEntitiesSeed = process.env.DEMO_MULTI_CONTEXT === 'true';

  const existingKeWorkspace = await prisma.outsourcingClient.findFirst({
    where: {
      organizationId: demoOrganizationId,
      ...(skipOperatingEntitiesSeed
        ? { entityCode: keSlug }
        : {
            OR: [
              { entityCode: keSlug },
              { entityCode: 'ke' },
              { name: pack.workspace.name },
              ...pack.legacyWorkspaceNames.map((name) => ({ name })),
            ],
          }),
    },
    select: { id: true },
  });
  const keClient = existingKeWorkspace
    ? await prisma.outsourcingClient.update({
        where: { id: existingKeWorkspace.id },
        data: {
          name: pack.entities.ke.legalName,
          entityCode: keSlug,
          contactName: pack.entities.ke.contactName,
          contactEmail: pack.entities.ke.contactEmail,
          contactPhone: pack.entities.ke.contactPhone,
          postalAddress: pack.entities.ke.postalAddress,
          county: pack.entities.ke.county,
          employeeNumberPrefix: pack.entities.ke.employeeNumberPrefix,
          payrollFrequency: pack.workspace.payrollFrequency,
          leavePayMode: pack.workspace.leavePayMode,
          currency: pack.entities.ke.currency,
        },
      })
    : await prisma.outsourcingClient.create({
        data: {
          name: pack.entities.ke.legalName,
          entityCode: keSlug,
          contactName: pack.entities.ke.contactName,
          contactEmail: pack.entities.ke.contactEmail,
          contactPhone: pack.entities.ke.contactPhone,
          postalAddress: pack.entities.ke.postalAddress,
          county: pack.entities.ke.county,
          employeeNumberPrefix: pack.entities.ke.employeeNumberPrefix,
          payrollFrequency: pack.workspace.payrollFrequency,
          leavePayMode: pack.workspace.leavePayMode,
          currency: pack.entities.ke.currency,
        },
      });

  let ugClient = await prisma.outsourcingClient.findFirst({
    where: { organizationId: demoOrganizationId, entityCode: ugSlug },
  });
  if (!ugClient && !skipOperatingEntitiesSeed) {
    ugClient = await prisma.outsourcingClient.findFirst({
      where: { organizationId: demoOrganizationId, entityCode: 'ug' },
    });
  }
  if (!ugClient) {
    ugClient = await prisma.outsourcingClient.create({
      data: {
        name: pack.entities.ug.legalName,
        entityCode: ugSlug,
        contactName: pack.entities.ug.contactName,
        contactEmail: pack.entities.ug.contactEmail,
        contactPhone: pack.entities.ug.contactPhone,
        postalAddress: pack.entities.ug.postalAddress,
        county: pack.entities.ug.county,
        employeeNumberPrefix: pack.entities.ug.employeeNumberPrefix,
        payrollFrequency: pack.workspace.payrollFrequency,
        leavePayMode: pack.workspace.leavePayMode,
        currency: pack.entities.ug.currency,
      },
    });
  } else {
    ugClient = await prisma.outsourcingClient.update({
      where: { id: ugClient.id },
      data: {
        name: pack.entities.ug.legalName,
        contactName: pack.entities.ug.contactName,
        contactEmail: pack.entities.ug.contactEmail,
        contactPhone: pack.entities.ug.contactPhone,
        postalAddress: pack.entities.ug.postalAddress,
        employeeNumberPrefix: pack.entities.ug.employeeNumberPrefix,
        currency: pack.entities.ug.currency,
      },
    });
  }

  const { OPERATING_ENTITIES_SETTINGS_KEY, sanitizeOperatingEntitiesSettings } = await import(
    '../src/lib/operating-entities'
  );
  const { isMultiEntityEnvEnabled } = await import('../src/lib/deployment-config');
  if (!skipOperatingEntitiesSeed) {
    const demoEntitySettings = sanitizeOperatingEntitiesSettings({
      multiEntityEnabled: isMultiEntityEnvEnabled() || true,
      defaultEntityId: keSlug,
      entities: [
        {
          id: keSlug,
          legalName: pack.entities.ke.legalName,
          countryCode: 'KE',
          currency: pack.entities.ke.currency,
          employeeNumberPrefix: pack.entities.ke.employeeNumberPrefix,
          isActive: true,
        },
        {
          id: ugSlug,
          legalName: pack.entities.ug.legalName,
          countryCode: 'UG',
          currency: pack.entities.ug.currency,
          employeeNumberPrefix: pack.entities.ug.employeeNumberPrefix,
          isActive: true,
        },
      ],
    });
    await prisma.systemSetting.upsert({
      where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
      update: { value: demoEntitySettings },
      create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: demoEntitySettings },
    });
  }

  await prisma.outsourcingClient.deleteMany({
    where: {
      id: { notIn: [keClient.id, ugClient.id] },
      employees: { none: {} },
      entityCode: null,
    },
  });

  await prisma.employee.deleteMany({
    where: { outsourcingClientId: { in: [keClient.id, ugClient.id] } },
  });
  await prisma.department.deleteMany({
    where: { outsourcingClientId: { in: [keClient.id, ugClient.id] } },
  });

  if (hasModel('publicHoliday')) {
    for (const holiday of kenyanHolidays) {
      const existing = await prismaCompat.publicHoliday.findFirst({
        where: holiday.recurring
          ? {
              name: holiday.name,
              recurring: true,
              recurMonth: holiday.recurMonth,
              recurDay: holiday.recurDay,
            }
          : { name: holiday.name, date: new Date(`${holiday.date}T00:00:00.000Z`) },
        select: { id: true },
      });
      if (existing) {
        await prismaCompat.publicHoliday.update({
          where: { id: existing.id },
          data: {
            recurring: holiday.recurring,
            date: holiday.recurring ? null : new Date(`${holiday.date}T00:00:00.000Z`),
            recurMonth: holiday.recurring ? holiday.recurMonth : null,
            recurDay: holiday.recurring ? holiday.recurDay : null,
            isActive: true,
          },
        });
      } else {
        await prismaCompat.publicHoliday.create({
          data: {
            name: holiday.name,
            recurring: holiday.recurring,
            date: holiday.recurring ? null : new Date(`${holiday.date}T00:00:00.000Z`),
            recurMonth: holiday.recurring ? holiday.recurMonth : null,
            recurDay: holiday.recurring ? holiday.recurDay : null,
            isActive: true,
          },
        });
      }
    }
  }

  await seedPackRecruitmentJobs(now);
  await seedPackRecruitmentAssessments(prismaCompat);
  await seedPackRecruitmentApplicationsAndInterviews();

  const deptByClientId = new Map<string, Map<string, string>>();
  for (const client of [keClient, ugClient]) {
    const deptByName = new Map<string, string>();
    for (const name of pack.departments) {
      const existing = await prisma.department.findFirst({
        where: { outsourcingClientId: client.id, name },
        select: { id: true },
      });
      if (existing) {
        deptByName.set(name, existing.id);
      } else {
        const created = await prisma.department.create({
          data: { outsourcingClientId: client.id, name },
          select: { id: true },
        });
        deptByName.set(name, created.id);
      }
    }
    deptByClientId.set(client.id, deptByName);
  }

  const employeeByEmail = new Map<string, Awaited<ReturnType<typeof prisma.employee.upsert>>>();
  for (const emp of pack.employees) {
    const isUganda = emp.employeeNumber.startsWith(pack.entities.ug.employeeNumberPrefix);
    const clientId = isUganda ? ugClient.id : keClient.id;
    const deptMap = deptByClientId.get(clientId)!;
    const employee = await prisma.employee.upsert({
      where: { idNumber: emp.idNumber },
      update: {
        outsourcingClientId: clientId,
        departmentId: deptMap.get(emp.department) ?? null,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        kraPin: emp.kraPin,
        nssfNumber: emp.nssfNumber,
        nhifNumber: emp.nhifNumber,
        dateOfJoining: emp.dateOfJoining,
        jobTitle: emp.role,
        baseSalary: new Prisma.Decimal(emp.baseSalary),
        bankName: emp.bankName,
        bankBranch: emp.bankBranch,
        bankAccountNumber: emp.bankAccountNumber,
      },
      create: {
        outsourcingClientId: clientId,
        departmentId: deptMap.get(emp.department) ?? null,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        idNumber: emp.idNumber,
        kraPin: emp.kraPin,
        nssfNumber: emp.nssfNumber,
        nhifNumber: emp.nhifNumber,
        dateOfJoining: emp.dateOfJoining,
        jobTitle: emp.role,
        baseSalary: new Prisma.Decimal(emp.baseSalary),
        bankName: emp.bankName,
        bankBranch: emp.bankBranch,
        bankAccountNumber: emp.bankAccountNumber,
      },
    });
    employeeByEmail.set(emp.email, employee);
  }

  for (const c of pack.credentials) {
    const employee = employeeByEmail.get(c.email);
    if (!employee) continue;
    const existing = await prisma.employeeCredential.findFirst({
      where: {
        employeeId: employee.id,
        credentialName: c.name,
        credentialNumber: c.number,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.employeeCredential.update({
        where: { id: existing.id },
        data: {
          category: c.category,
          issuingAuthority: c.authority,
          issueDate: c.issue,
          expiryDate: c.expiry,
          status: c.status,
          reminderDays: 30,
        },
      });
    } else {
      await prisma.employeeCredential.create({
        data: {
          employeeId: employee.id,
          category: c.category,
          credentialName: c.name,
          credentialNumber: c.number,
          issuingAuthority: c.authority,
          issueDate: c.issue,
          expiryDate: c.expiry,
          status: c.status,
          reminderDays: 30,
        },
      });
    }
  }

  const shiftTemplateDefs = [
    { name: 'Day shift', startMinutes: 8 * 60, endMinutes: 20 * 60, breakMinutes: 60, color: '#2563eb' },
    { name: 'Night shift', startMinutes: 20 * 60, endMinutes: 8 * 60, breakMinutes: 60, color: '#1e293b' },
    { name: 'Peak retail', startMinutes: 7 * 60, endMinutes: 19 * 60, breakMinutes: 45, color: '#7c3aed' },
    { name: 'Depot extended', startMinutes: 6 * 60, endMinutes: 22 * 60, breakMinutes: 60, color: '#a16207' },
    { name: 'Admin day', startMinutes: 8 * 60, endMinutes: 17 * 60, breakMinutes: 60, color: '#059669' },
    { name: 'Station on-call', startMinutes: 8 * 60, endMinutes: 8 * 60, breakMinutes: 120, color: '#dc2626' },
  ];

  const templateIdByClientAndName = new Map<string, string>();
  for (const client of [keClient, ugClient]) {
    for (const t of shiftTemplateDefs) {
      const mapKey = `${client.id}:${t.name}`;
      const existing = await prisma.shiftTemplate.findFirst({
        where: { outsourcingClientId: client.id, name: t.name },
        select: { id: true },
      });
      if (existing) {
        await prisma.shiftTemplate.update({
          where: { id: existing.id },
          data: {
            startMinutes: t.startMinutes,
            endMinutes: t.endMinutes,
            breakMinutes: t.breakMinutes,
            color: t.color,
            isActive: true,
          },
        });
        templateIdByClientAndName.set(mapKey, existing.id);
      } else {
        const created = await prisma.shiftTemplate.create({
          data: { outsourcingClientId: client.id, ...t, isActive: true },
        });
        templateIdByClientAndName.set(mapKey, created.id);
      }
    }
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const rotaIdByClientId = new Map<string, string>();
  for (const client of [keClient, ugClient]) {
    let rota = await prisma.rotaPeriod.findFirst({
      where: {
        outsourcingClientId: client.id,
        startDate: monthStart,
        endDate: monthEnd,
      },
    });
    if (!rota) {
      rota = await prisma.rotaPeriod.create({
        data: {
          outsourcingClientId: client.id,
          name: `${now.toLocaleString('en-GB', { month: 'long' })} ${now.getUTCFullYear()} Rota`,
          startDate: monthStart,
          endDate: monthEnd,
          status: 'published',
        },
      });
    } else if (rota.status !== 'published') {
      rota = await prisma.rotaPeriod.update({ where: { id: rota.id }, data: { status: 'published' } });
    }
    rotaIdByClientId.set(client.id, rota.id);
  }

  const roleEmails = pack.staffUsers.roleEmails;

  const rotationStart = daysFromToday(-14);
  const monday = new Date(rotationStart);
  const mondayDow = monday.getUTCDay();
  const shift = mondayDow === 0 ? -6 : 1 - mondayDow;
  monday.setUTCDate(monday.getUTCDate() + shift);

  const assignmentsSeed: Array<{ email: string; date: Date; template: string }> = [];
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    const dow = day.getUTCDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const ymd = isoDate(day);
    if (day >= monthStart && day <= monthEnd) {
      assignmentsSeed.push({ email: roleEmails.brian, date: day, template: i % 5 === 0 ? 'Day shift' : 'Night shift' });
      assignmentsSeed.push({ email: roleEmails.grace, date: day, template: i % 2 === 0 ? 'Day shift' : 'Night shift' });
      assignmentsSeed.push({ email: roleEmails.robert, date: day, template: i % 2 === 0 ? 'Night shift' : 'Day shift' });
      assignmentsSeed.push({ email: roleEmails.aisha, date: day, template: i % 2 === 0 ? 'Day shift' : 'Night shift' });
      assignmentsSeed.push({ email: roleEmails.moses, date: day, template: i % 3 === 0 ? 'Depot extended' : 'Peak retail' });
      assignmentsSeed.push({ email: roleEmails.paul, date: day, template: i % 4 === 0 ? 'Depot extended' : 'Peak retail' });
      assignmentsSeed.push({ email: roleEmails.harriet, date: day, template: 'Day shift' });
      assignmentsSeed.push({ email: roleEmails.kevin, date: day, template: isWeekday ? 'Admin day' : 'Day shift' });
      assignmentsSeed.push({ email: roleEmails.diana, date: day, template: isWeekday ? 'Admin day' : 'Day shift' });
      assignmentsSeed.push({ email: roleEmails.james, date: day, template: isWeekday ? 'Admin day' : 'Day shift' });
    }
    if (ymd === `${marchYear}-03-24`) {
      // no-op marker for static demo date references
    }
  }

  for (const item of assignmentsSeed) {
    const employee = employeeByEmail.get(item.email);
    if (!employee) continue;
    const rotaId = rotaIdByClientId.get(employee.outsourcingClientId);
    if (!rotaId) continue;
    const tplKey = `${employee.outsourcingClientId}:${item.template}`;
    const templateId = templateIdByClientAndName.get(tplKey);
    if (!templateId) continue;
    const template = shiftTemplateDefs.find((s) => s.name === item.template)!;
    const workYmd = isoDate(item.date);
    const startsAt = atUtc(workYmd, `${String(Math.floor(template.startMinutes / 60)).padStart(2, '0')}:${String(template.startMinutes % 60).padStart(2, '0')}`);
    const crossesMidnight = template.endMinutes <= template.startMinutes;
    const endDate = new Date(item.date);
    if (crossesMidnight) endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endYmd = isoDate(endDate);
    const endsAt = atUtc(endYmd, `${String(Math.floor(template.endMinutes / 60)).padStart(2, '0')}:${String(template.endMinutes % 60).padStart(2, '0')}`);

    const existing = await prisma.shiftAssignment.findFirst({
      where: { rotaPeriodId: rotaId, employeeId: employee.id, workDate: new Date(`${workYmd}T00:00:00.000Z`) },
      select: { id: true },
    });
    if (existing) {
      await prisma.shiftAssignment.update({
        where: { id: existing.id },
        data: { shiftTemplateId: templateId, startsAt, endsAt, breakMinutes: template.breakMinutes },
      });
    } else {
      await prisma.shiftAssignment.create({
        data: {
          rotaPeriodId: rotaId,
          employeeId: employee.id,
          shiftTemplateId: templateId,
          workDate: new Date(`${workYmd}T00:00:00.000Z`),
          startsAt,
          endsAt,
          breakMinutes: template.breakMinutes,
        },
      });
    }
  }

  const attendanceRows = [
    { email: roleEmails.brian, date: isoDate(daysFromToday(-2)), checkIn: '19:55', checkOut: '08:10', overtimeMinutes: 15, lateMinutes: 0, notes: 'Cross-midnight night shift — Nairobi West' },
    { email: roleEmails.paul, date: isoDate(daysFromToday(-3)), checkIn: '06:50', checkOut: '23:15', overtimeMinutes: 84, lateMinutes: 0, notes: 'Extended depot coverage — Jinja Road' },
    { email: roleEmails.grace, date: todayYmd, checkIn: '08:02', checkOut: null, overtimeMinutes: 0, lateMinutes: 2, notes: 'Missing clock-out for supervisor review' },
    { email: roleEmails.aisha, date: isoDate(daysFromToday(-1)), checkIn: '08:47', checkOut: '20:05', overtimeMinutes: 5, lateMinutes: 47, notes: 'Late arrival — Mombasa Road' },
    { email: roleEmails.robert, date: isoDate(daysFromToday(-4)), checkIn: '07:58', checkOut: '21:30', overtimeMinutes: 90, lateMinutes: 0, notes: 'Corrected clock-out after peak retail evening' },
    { email: roleEmails.harriet, date: isoDate(daysFromToday(-5)), checkIn: '07:55', checkOut: '20:04', overtimeMinutes: 4, lateMinutes: 0, notes: null },
    { email: roleEmails.moses, date: isoDate(daysFromToday(-6)), checkIn: '08:03', checkOut: '20:07', overtimeMinutes: 7, lateMinutes: 3, notes: null },
    { email: roleEmails.kevin, date: isoDate(daysFromToday(-7)), checkIn: '08:01', checkOut: '17:12', overtimeMinutes: 12, lateMinutes: 1, notes: null },
    { email: roleEmails.james, date: isoDate(daysFromToday(-8)), checkIn: '07:02', checkOut: '19:10', overtimeMinutes: 10, lateMinutes: 2, notes: null },
    { email: roleEmails.paul, date: isoDate(daysFromToday(-9)), checkIn: '06:58', checkOut: '23:02', overtimeMinutes: 62, lateMinutes: 0, notes: null },
    { email: roleEmails.brian, date: isoDate(daysFromToday(-10)), checkIn: '20:04', checkOut: '08:08', overtimeMinutes: 8, lateMinutes: 4, notes: null },
    { email: roleEmails.robert, date: isoDate(daysFromToday(-11)), checkIn: '20:07', checkOut: '08:00', overtimeMinutes: 0, lateMinutes: 7, notes: null },
    { email: roleEmails.grace, date: isoDate(daysFromToday(-12)), checkIn: '08:11', checkOut: '20:00', overtimeMinutes: 0, lateMinutes: 11, notes: null },
    { email: roleEmails.aisha, date: isoDate(daysFromToday(-13)), checkIn: '08:06', checkOut: '19:52', overtimeMinutes: 0, lateMinutes: 6, notes: null },
  ];

  for (const row of attendanceRows) {
    const employee = employeeByEmail.get(row.email);
    if (!employee) continue;
    const workDate = new Date(`${row.date}T00:00:00.000Z`);
    const checkIn = atUtc(row.date, row.checkIn);
    const checkOut = row.checkOut
      ? (() => {
          const out = atUtc(row.date, row.checkOut);
          if (row.checkOut < row.checkIn) out.setUTCDate(out.getUTCDate() + 1);
          return out;
        })()
      : null;

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: workDate } },
      update: { checkIn, checkOut, notes: row.notes },
      create: { employeeId: employee.id, date: workDate, checkIn, checkOut, notes: row.notes },
    });

    const workedMinutes = checkOut ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)) : 0;
    if (hasModel('attendanceDaySummary')) {
      await prismaCompat.attendanceDaySummary.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        update: {
          outsourcingClientId: employee.outsourcingClientId,
          firstInAt: checkIn,
          lastOutAt: checkOut,
          minutesWorked: workedMinutes,
          lateMinutes: row.lateMinutes,
          overtimeMinutes: row.overtimeMinutes,
          holidayOvertimeMinutes: 0,
          publicHolidayName: null,
          status: checkOut ? AttendanceSummaryStatus.reconciled : AttendanceSummaryStatus.draft,
        },
        create: {
          employeeId: employee.id,
          outsourcingClientId: employee.outsourcingClientId,
          workDate,
          firstInAt: checkIn,
          lastOutAt: checkOut,
          minutesWorked: workedMinutes,
          lateMinutes: row.lateMinutes,
          overtimeMinutes: row.overtimeMinutes,
          holidayOvertimeMinutes: 0,
          publicHolidayName: null,
          status: checkOut ? AttendanceSummaryStatus.reconciled : AttendanceSummaryStatus.draft,
        },
      });
    }
  }

  if (pack.id === 'hospital-healthcare' && hasModel('attendanceDaySummary')) {
    const staff = await prisma.employee.findMany({
      where: { outsourcingClientId: keClient.id },
      select: { id: true, outsourcingClientId: true },
      orderBy: { employeeNumber: 'asc' },
    });
    let idx = 0;
    for (const employee of staff) {
      const workDate = new Date(`${todayYmd}T00:00:00.000Z`);
      const existing = await prismaCompat.attendanceDaySummary.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      });
      if (existing?.firstInAt) {
        idx += 1;
        continue;
      }
      if (idx % 6 === 5) {
        idx += 1;
        continue;
      }

      const hh = String(6 + (idx % 3)).padStart(2, '0');
      const mm = String((idx * 7) % 60).padStart(2, '0');
      const checkIn = atUtc(todayYmd, `${hh}:${mm}`);
      const checkOut = atUtc(todayYmd, `${String(16 + (idx % 2)).padStart(2, '0')}:${mm}`);
      const workedMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: workDate } },
        update: { checkIn, checkOut, notes: 'Clinical shift — demo seed' },
        create: {
          employeeId: employee.id,
          date: workDate,
          checkIn,
          checkOut,
          notes: 'Clinical shift — demo seed',
        },
      });

      await prismaCompat.attendanceDaySummary.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        update: {
          outsourcingClientId: employee.outsourcingClientId,
          firstInAt: checkIn,
          lastOutAt: checkOut,
          minutesWorked: workedMinutes,
          lateMinutes: idx % 11 === 0 ? 12 : 0,
          overtimeMinutes: 0,
          holidayOvertimeMinutes: 0,
          publicHolidayName: null,
          status: AttendanceSummaryStatus.reconciled,
        },
        create: {
          employeeId: employee.id,
          outsourcingClientId: employee.outsourcingClientId,
          workDate,
          firstInAt: checkIn,
          lastOutAt: checkOut,
          minutesWorked: workedMinutes,
          lateMinutes: idx % 11 === 0 ? 12 : 0,
          overtimeMinutes: 0,
          holidayOvertimeMinutes: 0,
          publicHolidayName: null,
          status: AttendanceSummaryStatus.reconciled,
        },
      });
      idx += 1;
    }
    console.log(`→ Hospital demo: seeded today attendance for ${idx} staff on ${todayYmd}`);
  }

  const grace = employeeByEmail.get(roleEmails.grace);
  const aisha = employeeByEmail.get(roleEmails.aisha);
  if (grace && hasModel('attendanceException')) {
    await upsertAttendanceException({
      employeeId: grace.id,
      workDate: new Date(`${todayYmd}T00:00:00.000Z`),
      type: AttendanceExceptionType.missing_check_out,
      status: AttendanceExceptionStatus.open,
      description: 'No check-out event found for this shift/day window.',
    });
  }
  if (aisha && hasModel('attendanceException')) {
    await upsertAttendanceException({
      employeeId: aisha.id,
      workDate: new Date(`${isoDate(daysFromToday(-1))}T00:00:00.000Z`),
      type: AttendanceExceptionType.late_arrival,
      status: AttendanceExceptionStatus.open,
      description: 'Clock-in occurred 47 minutes after scheduled shift start.',
    });
  }

  if (hasModel('attendancePolicy') && hasModel('attendancePolicyAssignment')) {
    for (const client of [keClient, ugClient]) {
      const policy = await prismaCompat.attendancePolicy.upsert({
        where: { id: `default-attendance-${client.id}` },
        update: {
          outsourcingClientId: client.id,
          name: 'Default attendance policy',
          mode: AttendancePolicyMode.hybrid_override,
          graceInMinutes: 10,
          graceOutMinutes: 10,
          minHalfDayMinutes: 240,
          fullDayMinutes: 480,
          requireManualApproval: true,
          mobileGeofenceEnabled: true,
          rejectOutsideGeofence: true,
          isDefault: true,
          isActive: true,
        },
        create: {
          id: `default-attendance-${client.id}`,
          outsourcingClientId: client.id,
          name: 'Default attendance policy',
          mode: AttendancePolicyMode.hybrid_override,
          graceInMinutes: 10,
          graceOutMinutes: 10,
          minHalfDayMinutes: 240,
          fullDayMinutes: 480,
          requireManualApproval: true,
          mobileGeofenceEnabled: true,
          rejectOutsideGeofence: true,
          isDefault: true,
          isActive: true,
        },
      });

      for (const employee of employeeByEmail.values()) {
        if (employee.outsourcingClientId !== client.id) continue;
        await prismaCompat.attendancePolicyAssignment.upsert({
          where: { id: `${employee.id}-${policy.id}` },
          update: { effectiveFrom: d(2026, 1, 1), effectiveTo: null, isPrimary: true },
          create: {
            id: `${employee.id}-${policy.id}`,
            employeeId: employee.id,
            attendancePolicyId: policy.id,
            effectiveFrom: d(2026, 1, 1),
            effectiveTo: null,
            isPrimary: true,
          },
        });
      }
    }
  }

  if (hasModel('attendanceWorkSite')) {
    const demoSites: Array<{ clientId: string; id: string; name: string; lat: number; lng: number }> = [
      {
        clientId: keClient.id,
        id: `worksite-hq-${keClient.id}`,
        name: 'Heritage Nairobi HQ',
        lat: -1.2674,
        lng: 36.8116,
      },
      {
        clientId: ugClient.id,
        id: `worksite-hq-${ugClient.id}`,
        name: 'Heritage Kampala Office',
        lat: 0.3476,
        lng: 32.5825,
      },
    ];
    for (const site of demoSites) {
      await prismaCompat.attendanceWorkSite.upsert({
        where: { id: site.id },
        update: {
          outsourcingClientId: site.clientId,
          name: site.name,
          latitude: site.lat,
          longitude: site.lng,
          radiusMeters: 200,
          isActive: true,
        },
        create: {
          id: site.id,
          outsourcingClientId: site.clientId,
          name: site.name,
          latitude: site.lat,
          longitude: site.lng,
          radiusMeters: 200,
          isActive: true,
        },
      });
    }
  }

  const leaveTypeDefs = [
    { name: 'Annual Leave', daysPerYear: 21 },
    { name: 'Sick Leave', daysPerYear: 14 },
    { name: 'Compassionate Leave', daysPerYear: 5 },
    { name: 'Maternity Leave', daysPerYear: 90 },
    { name: 'Paternity Leave', daysPerYear: 14 },
    { name: 'Study Leave', daysPerYear: 0 },
    { name: 'Unpaid Leave', daysPerYear: 0 },
  ];
  const leaveTypeByName = new Map<string, string>();
  for (const lt of leaveTypeDefs) {
    const existing = await prisma.leaveType.findFirst({ where: { name: lt.name } });
    if (existing) {
      await prisma.leaveType.update({ where: { id: existing.id }, data: { daysPerYear: lt.daysPerYear } });
      leaveTypeByName.set(lt.name, existing.id);
    } else {
      const created = await prisma.leaveType.create({ data: lt });
      leaveTypeByName.set(lt.name, created.id);
    }
  }

  const leavePolicyByClientId = new Map<string, string>();
  if (prismaCompat.leavePolicy) {
    for (const client of [keClient, ugClient]) {
      const leavePolicy = await prismaCompat.leavePolicy.upsert({
        where: { id: `default-leave-${client.id}` },
        update: {
          outsourcingClientId: client.id,
          name: 'Standard Leave Policy',
          description: 'Default leave policy for demo data data.',
          isDefault: true,
          isActive: true,
        },
        create: {
          id: `default-leave-${client.id}`,
          outsourcingClientId: client.id,
          name: 'Standard Leave Policy',
          description: 'Default leave policy for demo data data.',
          isDefault: true,
          isActive: true,
        },
      });
      leavePolicyByClientId.set(client.id, leavePolicy.id);

      if (prismaCompat.leavePolicyRule) {
        for (const lt of leaveTypeDefs) {
          const leaveTypeId = leaveTypeByName.get(lt.name)!;
          await prismaCompat.leavePolicyRule.upsert({
            where: { leavePolicyId_leaveTypeId: { leavePolicyId: leavePolicy.id, leaveTypeId } },
            update: {
              accrualMode: lt.daysPerYear > 0 ? LeaveAccrualMode.monthly_accrual : LeaveAccrualMode.annual_grant,
              annualEntitlement: lt.daysPerYear,
              monthlyAccrualDays: new Prisma.Decimal(lt.daysPerYear > 0 ? (lt.daysPerYear / 12).toFixed(2) : '0'),
              maxCarryForwardDays: lt.name === 'Annual Leave' ? 10 : 0,
              requiresApproval: !lt.name.includes('Unpaid'),
              active: true,
            },
            create: {
              leavePolicyId: leavePolicy.id,
              leaveTypeId,
              accrualMode: lt.daysPerYear > 0 ? LeaveAccrualMode.monthly_accrual : LeaveAccrualMode.annual_grant,
              annualEntitlement: lt.daysPerYear,
              monthlyAccrualDays: new Prisma.Decimal(lt.daysPerYear > 0 ? (lt.daysPerYear / 12).toFixed(2) : '0'),
              maxCarryForwardDays: lt.name === 'Annual Leave' ? 10 : 0,
              requiresApproval: !lt.name.includes('Unpaid'),
              active: true,
            },
          });
        }
      }
    }
  }

  const annualTypeId = leaveTypeByName.get('Annual Leave')!;
  const sickTypeId = leaveTypeByName.get('Sick Leave')!;
  for (const [email, employee] of employeeByEmail.entries()) {
    const seed = pack.employees.find((s) => s.email === email)!;
    const join = seed.dateOfJoining;
    const monthsWorked = Math.max(1, (currentYear - join.getUTCFullYear()) * 12 + (now.getUTCMonth() - join.getUTCMonth()) + 1);
    const accruedAnnual = Math.min(21, Math.floor((monthsWorked * 21) / 12));
    const accruedSick = Math.min(14, Math.floor((monthsWorked * 14) / 12));

    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: annualTypeId, year: currentYear } },
      update: { balance: accruedAnnual, used: 0 },
      create: { employeeId: employee.id, leaveTypeId: annualTypeId, year: currentYear, balance: accruedAnnual, used: 0 },
    });
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: sickTypeId, year: currentYear } },
      update: { balance: accruedSick, used: 0 },
      create: { employeeId: employee.id, leaveTypeId: sickTypeId, year: currentYear, balance: accruedSick, used: 0 },
    });
    const leavePolicyIdForEmployee = leavePolicyByClientId.get(employee.outsourcingClientId);
    if (leavePolicyIdForEmployee && prismaCompat.leavePolicyAssignment) {
      await prismaCompat.leavePolicyAssignment.upsert({
        where: { id: `${employee.id}-${leavePolicyIdForEmployee}` },
        update: { effectiveFrom: d(2026, 1, 1), effectiveTo: null },
        create: {
          id: `${employee.id}-${leavePolicyIdForEmployee}`,
          employeeId: employee.id,
          leavePolicyId: leavePolicyIdForEmployee,
          effectiveFrom: d(2026, 1, 1),
          effectiveTo: null,
        },
      });
    }
  }

  const kevin = employeeByEmail.get(roleEmails.kevin)!;
  const brian = employeeByEmail.get(roleEmails.brian)!;
  const aishaLeave = employeeByEmail.get(roleEmails.aisha)!;
  const annualLeaveType = annualTypeId;
  const sickLeaveType = sickTypeId;

  await upsertLeaveApplication(kevin.id, annualLeaveType, daysFromToday(0), daysFromToday(4), LeaveStatus.approved, 'Annual leave approved');
  await upsertLeaveApplication(brian.id, sickLeaveType, daysFromToday(-1), daysFromToday(2), LeaveStatus.approved, 'Sick leave — medical certificate on file');
  await upsertLeaveApplication(aishaLeave.id, annualLeaveType, daysFromToday(7), daysFromToday(11), LeaveStatus.pending, 'Pending annual leave request');
  const mosesLeave = employeeByEmail.get(roleEmails.moses);
  if (mosesLeave) {
    await upsertLeaveApplication(
      mosesLeave.id,
      sickLeaveType,
      daysFromToday(5),
      daysFromToday(7),
      LeaveStatus.pending,
      'Pending compassionate leave',
    );
  }

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  for (const monthData of [
    { month: 3, year: marchYear, status: PayrollStatus.approved },
    { month: 4, year: aprilYear, status: PayrollStatus.draft },
    { month: prevMonth, year: prevMonthYear, status: PayrollStatus.approved },
    { month: currentMonth, year: currentYear, status: PayrollStatus.draft },
  ]) {
    for (const seed of pack.employees) {
      const employee = employeeByEmail.get(seed.email);
      if (!employee) continue;
      const overtimeMinutes = hasModel('attendanceDaySummary')
        ? ((await prismaCompat.attendanceDaySummary.aggregate({
            where: {
              employeeId: employee.id,
              workDate: {
                gte: new Date(Date.UTC(monthData.year, monthData.month - 1, 1)),
                lt: new Date(Date.UTC(monthData.year, monthData.month, 1)),
              },
            },
            _sum: { overtimeMinutes: true },
          }))?._sum?.overtimeMinutes ?? 0)
        : 0;
      const overtimeAmount = Math.round((seed.baseSalary / 22560) * overtimeMinutes);
      const allowances = [...seed.allowances, { name: 'Overtime', amount: overtimeAmount }];
      const deductions: { name: string; amount: number }[] = [];
      const employmentGross = seed.baseSalary + allowances.reduce((sum, a) => sum + a.amount, 0);
      const statutory = calculateStatutoryForPayroll('none', employmentGross, 0, 0);

      await prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: employee.id, month: monthData.month, year: monthData.year } },
        update: {
          basicPay: new Prisma.Decimal(seed.baseSalary),
          allowances: allowances as unknown as Prisma.JsonArray,
          deductions: deductions as unknown as Prisma.JsonArray,
          grossPay: new Prisma.Decimal(statutory.grossPay),
          paye: new Prisma.Decimal(statutory.paye),
          nssf: new Prisma.Decimal(statutory.nssf),
          nhif: new Prisma.Decimal(statutory.nhif),
          ahl: new Prisma.Decimal(statutory.ahl),
          nita: new Prisma.Decimal(statutory.nita),
          netPay: new Prisma.Decimal(statutory.netPay),
          status: monthData.status,
        },
        create: {
          employeeId: employee.id,
          month: monthData.month,
          year: monthData.year,
          basicPay: new Prisma.Decimal(seed.baseSalary),
          allowances: allowances as unknown as Prisma.JsonArray,
          deductions: deductions as unknown as Prisma.JsonArray,
          grossPay: new Prisma.Decimal(statutory.grossPay),
          leavePay: new Prisma.Decimal(0),
          paye: new Prisma.Decimal(statutory.paye),
          nssf: new Prisma.Decimal(statutory.nssf),
          nhif: new Prisma.Decimal(statutory.nhif),
          ahl: new Prisma.Decimal(statutory.ahl),
          nita: new Prisma.Decimal(statutory.nita),
          netPay: new Prisma.Decimal(statutory.netPay),
          status: monthData.status,
        },
      });
    }
  }

  const hashed = await bcrypt.hash(pack.demoPassword, PASSWORD_ROUNDS);
  const demoAdmin =
    process.env.DEMO_MULTI_CONTEXT === 'true' && process.env.DEMO_UNIFIED_ADMIN_EMAIL?.trim()
      ? process.env.DEMO_UNIFIED_ADMIN_EMAIL.trim()
      : pack.staffUsers.admin.email;
  await prisma.user.upsert({
    where: { email: demoAdmin },
    update: { name: 'Amina Njeri', passwordHash: hashed, role: UserRole.admin, staffUserType: StaffUserType.director, isActive: true },
    create: { email: demoAdmin, name: pack.staffUsers.admin.name, passwordHash: hashed, role: UserRole.admin, staffUserType: StaffUserType.director, isActive: true },
  });
  await prisma.user.upsert({
    where: { email: roleEmails.diana },
    update: { name: 'Diana Namutebi', passwordHash: hashed, role: UserRole.staff, staffUserType: StaffUserType.business_manager, isActive: true },
    create: { email: roleEmails.diana, name: pack.staffUsers.hr.name, passwordHash: hashed, role: UserRole.staff, staffUserType: StaffUserType.business_manager, isActive: true },
  });
  await prisma.user.upsert({
    where: { email: roleEmails.james },
    update: { name: 'James Mwangi', passwordHash: hashed, role: UserRole.staff, staffUserType: StaffUserType.finance, isActive: true },
    create: { email: roleEmails.james, name: pack.staffUsers.finance.name, passwordHash: hashed, role: UserRole.staff, staffUserType: StaffUserType.finance, isActive: true },
  });
  const seededUsers = await prisma.user.findMany({
    where: { email: { in: [demoAdmin, roleEmails.diana, roleEmails.james] } },
    select: { id: true, email: true, name: true, role: true },
  });
  for (const user of seededUsers) {
    await ensureStaffOrgMembership(user.id, user.role);
  }
  const userByEmail = new Map(seededUsers.map((u) => [u.email.toLowerCase(), u]));
  const paul = employeeByEmail.get(roleEmails.paul);
  const robert = employeeByEmail.get(roleEmails.robert);
  const moses = employeeByEmail.get(roleEmails.moses);
  await prisma.auditEvent.createMany({
    data: [
      {
        actorUserId: userByEmail.get(roleEmails.diana)?.id ?? null,
        actorEmail: roleEmails.diana,
        action: 'employee.salary.view',
        entityType: 'Employee',
        entityId: paul?.id ?? null,
        route: 'GET /api/outsourcing/employees/[id]',
        metadata: { message: 'Diana Namutebi viewed employee salary: Paul Mugisha (Depot Supervisor)' },
        createdAt: new Date(Date.UTC(currentYear, 3, 26, 7, 30, 0)),
      },
      {
        actorUserId: userByEmail.get(roleEmails.james)?.id ?? null,
        actorEmail: roleEmails.james,
        action: 'payroll.run.approve',
        entityType: 'PayrollBatch',
        entityId: `${marchYear}-03`,
        route: 'POST /api/outsourcing/payroll/generate',
        metadata: { message: `James Mwangi approved payroll run March ${marchYear}` },
        createdAt: new Date(Date.UTC(currentYear, 3, 1, 11, 15, 0)),
      },
      {
        actorUserId: userByEmail.get(roleEmails.diana)?.id ?? null,
        actorEmail: roleEmails.diana,
        action: 'attendance.correction',
        entityType: 'Attendance',
        entityId: robert?.id ?? null,
        route: 'POST /api/outsourcing/attendance',
        metadata: { message: 'Diana Namutebi corrected attendance: Robert Ssemwogerere clock-out 20:00 -> 21:30' },
        createdAt: new Date(Date.UTC(currentYear, 3, 23, 18, 0, 0)),
      },
      {
        actorUserId: userByEmail.get(demoAdmin)?.id ?? null,
        actorEmail: demoAdmin,
        action: 'employee.create',
        entityType: 'Employee',
        entityId: moses?.id ?? null,
        route: 'POST /api/outsourcing/employees',
        metadata: { message: `${demoAdmin} created employee: Moses Okello` },
        createdAt: new Date(Date.UTC(currentYear, 3, 15, 8, 0, 0)),
      },
      {
        actorUserId: userByEmail.get(roleEmails.diana)?.id ?? null,
        actorEmail: roleEmails.diana,
        action: 'leave.approval',
        entityType: 'LeaveApplication',
        entityId: kevin?.id ?? null,
        route: 'PATCH /api/staff/leave/applications/[id]',
        metadata: { message: 'Diana Namutebi approved leave: Kevin Kamau annual leave' },
        createdAt: new Date(Date.UTC(currentYear, 3, 25, 12, 30, 0)),
      },
    ],
  });

  if (moses) {
    await prisma.essPortalUser.upsert({
      where: { email: pack.staffUsers.ess.email },
      update: {
        passwordHash: hashed,
        name: pack.staffUsers.ess.name,
        employeeId: moses.id,
        role: EssPortalRole.employee,
        isActive: true,
        mustResetPassword: false,
      },
      create: {
        email: pack.staffUsers.ess.email,
        name: pack.staffUsers.ess.name,
        passwordHash: hashed,
        employeeId: moses.id,
        role: EssPortalRole.employee,
        isActive: true,
        mustResetPassword: false,
      },
    });
  }

  await purgeStaleBrandAccounts();

  compatibility.push(
    {
      key: 'attendanceDaySummary',
      available: hasModel('attendanceDaySummary'),
      reasonIfSkipped: 'Attendance summary records and overtime-from-summary aggregation skipped.',
    },
    {
      key: 'attendanceException',
      available: hasModel('attendanceException'),
      reasonIfSkipped: 'Missing clock-out / late-arrival exception rows skipped.',
    },
    {
      key: 'attendancePolicy',
      available: hasModel('attendancePolicy'),
      reasonIfSkipped: 'Default attendance policy creation skipped.',
    },
    {
      key: 'attendancePolicyAssignment',
      available: hasModel('attendancePolicyAssignment'),
      reasonIfSkipped: 'Per-employee attendance policy assignment skipped.',
    },
    {
      key: 'leavePolicy',
      available: hasModel('leavePolicy'),
      reasonIfSkipped: 'Leave policy scaffold skipped (balances/applications still seeded).',
    },
    {
      key: 'leavePolicyRule',
      available: hasModel('leavePolicyRule'),
      reasonIfSkipped: 'Leave policy rules skipped.',
    },
    {
      key: 'leavePolicyAssignment',
      available: hasModel('leavePolicyAssignment'),
      reasonIfSkipped: 'Per-employee leave policy assignment skipped.',
    },
    {
      key: 'assessmentTemplate',
      available: hasModel('assessmentTemplate'),
      reasonIfSkipped: 'ATS assessment templates and job assignments skipped.',
    },
  );

  console.log(`Seed complete: ${pack.entities.ke.legalName} + ${pack.entities.ug.legalName} (entity switcher)`);
  console.log(`Careers board: ${pack.careersJobs.length} roles at ${pack.recruitmentEmployer}; demo candidates + interviews + talent pool seeded (${pack.pipelineEmailDomain} emails)`);
  console.log(`Employees: ${pack.employees.length} (${pack.recruitmentEmployer})`);
  console.log(`Credentials: ${pack.credentials.length} seeded (licences & safety certs; includes expiring-soon and expired samples)`);
  console.log(`Rota: published for ${monthStart.toISOString().slice(0, 10)} to ${monthEnd.toISOString().slice(0, 10)}`);
  console.log(`Attendance: ${attendanceRows.length} summary rows seeded for last 14 days`);
  console.log(`Payroll: March ${marchYear} approved, April ${aprilYear} draft`);
  console.log(`Users: demo admin (${demoAdmin}) + HR (${roleEmails.diana}) + finance (${roleEmails.james}) — password ${pack.demoPassword}`);
  console.log(`ESS portal: ${pack.staffUsers.ess.email} — same password (linked to employee record)`);
  console.log('Compatibility report:');
  for (const item of compatibility) {
    if (item.available) {
      console.log(` - ${item.key}: available`);
    } else {
      console.log(` - ${item.key}: skipped (${item.reasonIfSkipped})`);
    }
  }
}

async function upsertAttendanceException(input: {
  employeeId: string;
  workDate: Date;
  type: AttendanceExceptionType;
  status: AttendanceExceptionStatus;
  description: string;
}) {
  const existing = await prisma.attendanceException.findFirst({
    where: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      type: input.type,
    },
  });
  if (existing) {
    await prisma.attendanceException.update({
      where: { id: existing.id },
      data: { status: input.status, description: input.description },
    });
    return;
  }
  await prisma.attendanceException.create({ data: input });
}

async function upsertLeaveApplication(
  employeeId: string,
  leaveTypeId: string,
  startDate: Date,
  endDate: Date,
  status: LeaveStatus,
  reason: string,
) {
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const existing = await prisma.leaveApplication.findFirst({
    where: { employeeId, leaveTypeId, startDate: start, endDate: end },
  });
  if (existing) {
    await prisma.leaveApplication.update({
      where: { id: existing.id },
      data: { days, status, reason },
    });
  } else {
    await prisma.leaveApplication.create({
      data: { employeeId, leaveTypeId, startDate: start, endDate: end, days, status, reason },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
