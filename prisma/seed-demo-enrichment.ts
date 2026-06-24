/**
 * Enrich every vertical showcase company with full demo data for sector sales pitches.
 * Run after seed-demo-multi-vertical (or per-pack seed-demo).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PrismaClient,
  WorkflowType,
  WorkflowStatus,
  PayrollStatus,
  TrainingStatus,
  EnrollmentStatus,
  AnnouncementStatus,
  AnnouncementPriority,
  Prisma,
} from '@prisma/client';
import { startWorkflowForEmployee } from '../src/lib/onboarding-workflows';
import { calculateStatutoryForPayroll } from '../src/lib/payroll-calc';
import {
  demoEntityAnnouncementRoles,
  demoEntityDocumentTags,
  demoEntityNote,
} from '../src/lib/demo-entity-content';
import { VERTICAL_SHOWCASE_PACK_IDS } from './demo-packs/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();

type VerticalContent = {
  training: Array<{
    title: string;
    category: string;
    provider: string;
    status: TrainingStatus;
    durationHours: number;
    isOnline?: boolean;
  }>;
  announcements: Array<{
    title: string;
    body: string;
    priority: AnnouncementPriority;
    isPinned?: boolean;
  }>;
  documents: Array<{ title: string; category: string; department?: string }>;
};

const VERTICAL_CONTENT: Record<string, VerticalContent> = {
  'imara-sacco': {
    training: [
      { title: 'SASRA compliance & member data protection', category: 'Compliance', provider: 'Stride Academy', status: TrainingStatus.in_progress, durationHours: 6, isOnline: true },
      { title: 'Front-office service excellence', category: 'Customer service', provider: 'Kenya Institute of Management', status: TrainingStatus.scheduled, durationHours: 8 },
      { title: 'M-Pesa reconciliation for SACCOs', category: 'Finance', provider: 'Internal Finance', status: TrainingStatus.completed, durationHours: 4, isOnline: true },
    ],
    announcements: [
      { title: 'Annual general meeting — member communications pack', body: 'Board-approved AGM notices and branch talking points are published for all member-facing teams.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'SASRA quarterly returns reminder', body: 'Finance and compliance leads should validate member loan classifications before the reporting window closes.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'SASRA prudential guidelines summary', category: 'Compliance', department: 'Compliance' },
      { title: 'Member onboarding KYC checklist', category: 'Policy', department: 'Operations' },
      { title: 'Staff code of conduct', category: 'HR Policy', department: 'Human Resources' },
    ],
  },
  'petroleum-retail': {
    training: [
      { title: 'Fuel retail HSE & forecourt safety', category: 'HSE', provider: 'Energy Safety Institute', status: TrainingStatus.in_progress, durationHours: 5, isOnline: true },
      { title: 'Cash & stock reconciliation at station level', category: 'Operations', provider: 'Internal Ops', status: TrainingStatus.scheduled, durationHours: 6 },
      { title: 'Customer incident response (fuel retail)', category: 'Compliance', provider: 'Stride Academy', status: TrainingStatus.completed, durationHours: 3, isOnline: true },
    ],
    announcements: [
      { title: 'Wet-stock variance review — Q2', body: 'Regional managers to confirm dip readings and POS reconciliations for all Nairobi stations by Friday.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'Night-shift safety briefing', body: 'Updated PPE requirements for depot and forecourt teams are effective immediately.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'Forecourt emergency response plan', category: 'HSE', department: 'Operations' },
      { title: 'Station manager operating standard', category: 'SOP', department: 'Retail' },
      { title: 'Fuel handling & spill procedure', category: 'HSE', department: 'Operations' },
    ],
  },
  'cargo-logistics': {
    training: [
      { title: 'Driver safety & defensive driving', category: 'HSE', provider: 'Fleet Safety Kenya', status: TrainingStatus.in_progress, durationHours: 8 },
      { title: 'Warehouse inventory & dispatch controls', category: 'Operations', provider: 'Internal Logistics', status: TrainingStatus.scheduled, durationHours: 6, isOnline: true },
      { title: 'Dangerous goods awareness (ADR basics)', category: 'Compliance', provider: 'Stride Academy', status: TrainingStatus.completed, durationHours: 4, isOnline: true },
    ],
    announcements: [
      { title: 'Peak season rota — dispatch & drivers', body: 'Operations has published the June peak-season shift pattern. Confirm coverage with your line manager.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'Fleet telematics rollout', body: 'New GPS devices are being fitted across the Nairobi fleet — drivers will receive briefing slots this week.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'Driver journey management policy', category: 'Policy', department: 'Fleet & Drivers' },
      { title: 'Warehouse loading SOP', category: 'SOP', department: 'Warehouse' },
      { title: 'Customer SLA handbook', category: 'Operations', department: 'Dispatch' },
    ],
  },
  'hospital-healthcare': {
    training: [
      { title: 'Infection prevention & control refresher', category: 'Clinical', provider: 'Ministry of Health accredited', status: TrainingStatus.in_progress, durationHours: 4, isOnline: true },
      { title: 'Patient data confidentiality (health records)', category: 'Compliance', provider: 'Internal Clinical Governance', status: TrainingStatus.scheduled, durationHours: 3, isOnline: true },
      { title: 'Emergency triage for support staff', category: 'Clinical', provider: 'Amani Medical Centre', status: TrainingStatus.completed, durationHours: 6 },
    ],
    announcements: [
      { title: 'Clinical rota — theatre coverage', body: 'Theatre coordinators should review the updated on-call list for June and confirm handover contacts.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'Medical supplies stocktake', body: 'Pharmacy and stores teams to complete cycle count on critical medicines by month end.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'Clinical governance framework', category: 'Compliance', department: 'Clinical Services' },
      { title: 'Patient consent & records policy', category: 'Policy', department: 'Clinical Services' },
      { title: 'Occupational health & safety manual', category: 'HSE', department: 'Support Services' },
    ],
  },
  'travel-agency': {
    training: [
      { title: 'IATA billing & ticketing fundamentals', category: 'Operations', provider: 'Aviation Training Partners', status: TrainingStatus.in_progress, durationHours: 12 },
      { title: 'Corporate travel account management', category: 'Sales', provider: 'Horizon Travels Academy', status: TrainingStatus.scheduled, durationHours: 6, isOnline: true },
      { title: 'Travel fraud & payment security', category: 'Compliance', provider: 'Stride Academy', status: TrainingStatus.completed, durationHours: 3, isOnline: true },
    ],
    announcements: [
      { title: 'Summer charter promotions — sales playbook', body: 'Marketing has released destination bundles and commission structures for the peak travel season.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'Visa processing turnaround update', body: 'Embassy appointment slots for Schengen routes are limited — advise clients early on documentation.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'Corporate travel policy template', category: 'Policy', department: 'Sales' },
      { title: 'Refund & rebooking SOP', category: 'SOP', department: 'Operations' },
      { title: 'Supplier commission schedule', category: 'Finance', department: 'Finance' },
    ],
  },
};

function daysFromNow(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function entityPrefix(entityCode: string) {
  return entityCode.replace(/__ke$/i, '').replace(/[^a-z0-9]+/gi, '-').toUpperCase();
}

function packIdFromEntityCode(entityCode: string): string {
  return entityCode.replace(/__ke$/i, '');
}

async function ensureAccountsClients() {
  const { syncLinkedBillingClients } = await import('./lib/sync-linked-billing-clients.js');
  const result = await syncLinkedBillingClients(prisma);
  console.log(`→ Billing clients synced (${result.outsourcingSynced} outsourcing link(s))`);
}

async function wipeEntityScopedContent(entityCode: string) {
  await prisma.trainingEnrollment.deleteMany({
    where: { program: { notes: demoEntityNote(entityCode) } },
  });
  await prisma.trainingMaterial.deleteMany({
    where: { program: { notes: demoEntityNote(entityCode) } },
  });
  await prisma.trainingProgram.deleteMany({ where: { notes: demoEntityNote(entityCode) } });
  await prisma.announcement.deleteMany({
    where: { targetRoles: { path: ['demoEntityCode'], equals: entityCode } },
  });
  await prisma.companyDocument.deleteMany({
    where: { tags: { path: ['entityCode'], equals: entityCode } },
  });
}

async function seedSectorContent(
  entityCode: string,
  orgName: string,
  employees: Array<{ id: string; firstName: string; lastName: string }>,
  adminUserId: string,
) {
  const packId = packIdFromEntityCode(entityCode);
  const content = VERTICAL_CONTENT[packId];
  if (!content) return;

  await wipeEntityScopedContent(entityCode);

  for (const p of content.training) {
    const program = await prisma.trainingProgram.create({
      data: {
        title: p.title,
        description: `${p.title} — sector demo program for ${orgName}.`,
        category: p.category,
        provider: p.provider,
        isOnline: p.isOnline ?? false,
        durationHours: p.durationHours,
        status: p.status,
        currency: 'KES',
        notes: demoEntityNote(entityCode),
        createdByUserId: adminUserId,
        materials: { create: [{ title: 'Participant handbook (PDF)', sortOrder: 0 }] },
      },
    });
    for (const [i, emp] of employees.slice(0, 3).entries()) {
      await prisma.trainingEnrollment.create({
        data: {
          programId: program.id,
          employeeId: emp.id,
          enrolleeName: `${emp.firstName} ${emp.lastName}`,
          status:
            p.status === TrainingStatus.completed
              ? EnrollmentStatus.completed
              : i === 0
                ? EnrollmentStatus.in_progress
                : EnrollmentStatus.enrolled,
          completedAt: p.status === TrainingStatus.completed ? new Date() : null,
        },
      });
    }
  }

  for (const a of content.announcements) {
    await prisma.announcement.create({
      data: {
        title: a.title,
        body: a.body,
        status: AnnouncementStatus.published,
        priority: a.priority,
        authorUserId: adminUserId,
        publishedAt: new Date(),
        isPinned: a.isPinned ?? false,
        targetRoles: demoEntityAnnouncementRoles(entityCode),
      },
    });
  }

  for (const doc of content.documents) {
    await prisma.companyDocument.create({
      data: {
        title: doc.title,
        description: `${doc.title} — demo document for ${orgName}.`,
        category: doc.category,
        filePath: `/demo-documents/${packId}/${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        fileName: `${doc.title}.pdf`,
        fileSize: 245_000,
        mimeType: 'application/pdf',
        version: '1.0',
        status: 'published',
        uploadedByUserId: adminUserId,
        department: doc.department ?? null,
        tags: demoEntityDocumentTags(entityCode),
        effectiveDate: daysFromNow(-90),
      },
    });
  }
}

async function seedBiometricForClient(clientId: string, entityCode: string) {
  const prefix = entityPrefix(entityCode);
  const names = [`${prefix}-GATE-IN`, `${prefix}-GATE-OUT`];
  await prisma.biometricPunch.deleteMany({ where: { device: { name: { in: names } } } });
  await prisma.biometricDevice.deleteMany({ where: { name: { in: names } } });

  for (const [i, name] of names.entries()) {
    await prisma.biometricDevice.create({
      data: {
        outsourcingClientId: clientId,
        name,
        adapterKind: 'hikvision_isapi',
        config: { host: `10.20.${i + 1}.40`, port: 80, vendor: 'Hikvision' },
        isActive: true,
        lastPollAt: daysFromNow(-1),
      },
    });
  }
}

async function seedContractsForEntity(
  accountsClientId: string,
  managerUserId: string,
  prefix: string,
) {
  const refs = [`EMP-${prefix}-001`, `CONS-${prefix}-001`];
  await prisma.accountsContract.deleteMany({ where: { reference: { in: refs } } });

  await prisma.accountsContract.create({
    data: {
      clientId: accountsClientId,
      title: 'Permanent employment agreement',
      reference: refs[0]!,
      startDate: daysFromNow(-400),
      endDate: daysFromNow(120),
      remindersDisabled: false,
      managers: { create: [{ userId: managerUserId }] },
    },
  });

  await prisma.accountsContract.create({
    data: {
      clientId: accountsClientId,
      title: 'Consultant services agreement',
      reference: refs[1]!,
      startDate: daysFromNow(-180),
      endDate: daysFromNow(45),
      remindersDisabled: false,
      managers: { create: [{ userId: managerUserId }] },
    },
  });
}

async function seedDisciplinaryForEntity(
  entityCode: string,
  employees: Array<{ id: string; firstName: string; lastName: string }>,
  hrUserId: string,
) {
  const prefix = entityPrefix(entityCode);
  const year = new Date().getUTCFullYear();
  const caseNumber = `DC-${prefix}-${year}`;
  const grievanceNumber = `GR-${prefix}-${year}`;

  await prisma.disciplinaryAction.deleteMany({ where: { disciplinaryCase: { caseNumber } } });
  await prisma.disciplinaryDocument.deleteMany({ where: { disciplinaryCase: { caseNumber } } });
  await prisma.disciplinaryCase.deleteMany({ where: { caseNumber } });
  await prisma.grievance.deleteMany({ where: { grievanceNumber } });

  if (employees.length === 0) return;

  await prisma.disciplinaryCase.create({
    data: {
      employeeId: employees[0]!.id,
      caseNumber,
      type: 'ABSENTEEISM',
      status: 'OPEN',
      severity: 'MINOR',
      laborJurisdiction: 'KE',
      subject: `Attendance pattern review — ${employees[0]!.firstName} ${employees[0]!.lastName}`,
      description:
        'Line manager flagged repeated late clock-in on early shifts. Informal counselling completed; formal warning issued pending improvement plan.',
      incidentDate: daysFromNow(-21),
      reportedById: hrUserId,
      actions: {
        create: {
          type: 'VERBAL_WARNING',
          description: 'Verbal warning issued with 14-day improvement window.',
          actionDate: daysFromNow(-7),
          performedById: hrUserId,
          employeeAcknowledged: true,
          acknowledgedAt: daysFromNow(-5),
        },
      },
    },
  });

  if (employees.length > 1) {
    await prisma.grievance.create({
      data: {
        employeeId: employees[1]!.id,
        grievanceNumber,
        status: 'INVESTIGATING',
        category: 'MANAGEMENT',
        subject: 'Shift rota communication',
        description:
          'Employee raised concern about short-notice rota changes. HR review scheduled with operations lead.',
        investigationNotes: 'Initial meeting held; rota process review in progress.',
      },
    });
  }
}

async function seedOnboardingForEntity(
  employees: Array<{ id: string; firstName: string; lastName: string }>,
) {
  for (const employee of employees.slice(0, 2)) {
    const existing = await prisma.onboardingWorkflow.findFirst({
      where: { employeeId: employee.id, type: WorkflowType.ONBOARDING, status: WorkflowStatus.IN_PROGRESS },
    });
    if (!existing) {
      await startWorkflowForEmployee({ employeeId: employee.id, type: WorkflowType.ONBOARDING });
    }
  }
}

async function backfillPayrollForEntity(clientId: string) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: clientId, employmentStatus: 'active' },
    select: { id: true, baseSalary: true },
  });

  for (const monthData of [
    { month: prevMonth, year: prevYear, status: PayrollStatus.approved },
    { month: currentMonth, year: currentYear, status: PayrollStatus.draft },
  ]) {
    for (const employee of employees) {
      const base = employee.baseSalary ? Number(employee.baseSalary) : 85000;
      const statutory = calculateStatutoryForPayroll('none', base, 0, 0);
      await prisma.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: employee.id,
            month: monthData.month,
            year: monthData.year,
          },
        },
        update: {
          basicPay: new Prisma.Decimal(base),
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
          basicPay: new Prisma.Decimal(base),
          allowances: [],
          deductions: [],
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
}

async function enrichShowcaseVerticals() {
  const demoAdminEmail = (process.env.DEMO_UNIFIED_ADMIN_EMAIL ?? 'demo@demo.imara.co.ke').toLowerCase();
  const hrUser =
    (await prisma.user.findUnique({ where: { email: demoAdminEmail } })) ??
    (await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!hrUser) {
    console.warn('No staff user found — skip enrichment.');
    return;
  }

  const showcaseCodes = VERTICAL_SHOWCASE_PACK_IDS.map((id) => `${id}__ke`);
  const keClients = await prisma.outsourcingClient.findMany({
    where: { entityCode: { in: showcaseCodes } },
    orderBy: { entityCode: 'asc' },
  });

  for (const client of keClients) {
    const entityCode = client.entityCode!;
    const employees = await prisma.employee.findMany({
      where: { outsourcingClientId: client.id, employmentStatus: 'active' },
      orderBy: { employeeNumber: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (employees.length === 0) {
      console.warn(`  · ${entityCode}: no employees — skipped`);
      continue;
    }

    await seedOnboardingForEntity(employees);
    await seedDisciplinaryForEntity(entityCode, employees, hrUser.id);
    await backfillPayrollForEntity(client.id);
    await seedSectorContent(entityCode, client.name, employees, hrUser.id);
    await seedBiometricForClient(client.id, entityCode);

    const accountsClient = await prisma.accountsClient.findUnique({
      where: { outsourcingClientId: client.id },
    });
    if (accountsClient) {
      await seedContractsForEntity(accountsClient.id, hrUser.id, entityPrefix(entityCode));
    }

    console.log(
      `  ✓ ${client.name} — ${employees.length} staff, training, docs, onboarding, payroll, contracts`,
    );
  }
}

async function seedStaffLeaveDemo() {
  execSync('node prisma/seed-staff-leave.js', { cwd: root, stdio: 'inherit', env: process.env });

  const annualType = await prisma.staffLeaveType.findFirst({
    where: { name: { contains: 'Annual', mode: 'insensitive' } },
  });
  if (!annualType) return;

  const applicant =
    (await prisma.user.findFirst({ where: { email: { contains: 'hr.demo' } } })) ??
    (await prisma.user.findFirst({ where: { staffUserType: 'business_manager', isActive: true } }));
  if (!applicant) return;

  const existing = await prisma.staffLeaveApplication.findFirst({
    where: { userId: applicant.id, status: 'pending', leaveTypeId: annualType.id },
  });
  if (existing) return;

  await prisma.staffLeaveApplication.create({
    data: {
      userId: applicant.id,
      leaveTypeId: annualType.id,
      startDate: daysFromNow(14),
      endDate: daysFromNow(18),
      totalDays: 5,
      reason: 'Family event — demo pending approval',
      status: 'pending',
    },
  });
  console.log(`→ Staff leave: pending request for ${applicant.email}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');

  console.log('\nEnriching all vertical showcase companies with full sector demo data…\n');

  execSync('npx tsx prisma/seed-onboarding-templates.ts', { cwd: root, stdio: 'inherit', env: process.env });
  await ensureAccountsClients();
  await enrichShowcaseVerticals();
  await seedStaffLeaveDemo();

  console.log('\nAll vertical demos enriched.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
