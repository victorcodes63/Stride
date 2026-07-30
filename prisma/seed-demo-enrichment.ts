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
  AttendanceSummaryStatus,
  AccountsInvoiceStatus,
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
  construction: {
    training: [
      { title: 'Site safety induction (NCA-aligned)', category: 'HSE', provider: 'BuildSafe Kenya', status: TrainingStatus.in_progress, durationHours: 8 },
      { title: 'Plant operator competency refresh', category: 'Operations', provider: 'Kilimani Builders Academy', status: TrainingStatus.scheduled, durationHours: 6 },
      { title: 'Subcontractor payment & retention controls', category: 'Finance', provider: 'Stride Academy', status: TrainingStatus.completed, durationHours: 4, isOnline: true },
    ],
    announcements: [
      { title: 'Westlands Tower — crane lift schedule', body: 'Structural steel deliveries for level 3 are confirmed for next week. Site managers to brief subcontractors on access windows.', priority: AnnouncementPriority.high, isPinned: true },
      { title: 'Plant utilization review — Q2', body: 'Quantity surveying will publish plant hire vs budget variance by site this Friday.', priority: AnnouncementPriority.normal },
    ],
    documents: [
      { title: 'Site HSE plan template', category: 'HSE', department: 'Site Operations' },
      { title: 'Subcontractor mobilization checklist', category: 'SOP', department: 'Procurement' },
      { title: 'Project budget vs actual SOP', category: 'Finance', department: 'Quantity Surveying' },
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
  const client = await prisma.outsourcingClient.findUnique({
    where: { id: clientId },
    select: { organizationId: true },
  });
  if (!client) return;

  const prefix = entityPrefix(entityCode);
  const names = [`${prefix}-GATE-IN`, `${prefix}-GATE-OUT`];
  await prisma.biometricPunch.deleteMany({ where: { device: { name: { in: names } } } });
  await prisma.biometricDevice.deleteMany({
    where: { outsourcingClientId: clientId, name: { in: names } },
  });

  const devices = [];
  for (const [i, name] of names.entries()) {
    const device = await prisma.biometricDevice.create({
      data: {
        organizationId: client.organizationId,
        outsourcingClientId: clientId,
        name,
        adapterKind: 'hikvision_isapi',
        config: { host: `10.20.${i + 1}.40`, port: 80, vendor: 'Hikvision' },
        isActive: true,
        lastPollAt: daysFromNow(-1),
      },
    });
    devices.push(device);
  }

  const deviceIn = devices[0];
  const deviceOut = devices[1];
  if (!deviceIn || !deviceOut) return;

  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: clientId, employmentStatus: 'active' },
    orderBy: { employeeNumber: 'asc' },
    take: 12,
    select: { id: true, employeeNumber: true },
  });
  if (employees.length === 0) return;

  // Clear prior enrichment attendance events for these employees (reseed-safe).
  await prisma.attendanceEvent.deleteMany({
    where: {
      outsourcingClientId: clientId,
      employeeId: { in: employees.map((e) => e.id) },
      source: 'biometric',
      notes: 'demo-enrichment-punch',
    },
  });

  for (let dayOffset = -10; dayOffset <= -1; dayOffset++) {
    const day = daysFromNow(dayOffset);
    if (day.getUTCDay() === 0) continue;
    const workYmd = day.toISOString().slice(0, 10);
    const workDate = new Date(`${workYmd}T00:00:00.000Z`);

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i]!;
      const inHour = 7;
      const inMin = 45 + (i % 12);
      const outHour = 17;
      const outMin = 5 + (i % 20);
      const inAt = new Date(`${workYmd}T${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}:00.000Z`);
      const outAt = new Date(`${workYmd}T${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}:00.000Z`);

      const punchIn = await prisma.biometricPunch.create({
        data: {
          organizationId: client.organizationId,
          biometricDeviceId: deviceIn.id,
          externalEventId: `${prefix}-IN-${workYmd}-${emp.id.slice(-6)}`,
          observedAt: inAt,
          rawSubjectId: emp.employeeNumber ?? emp.id,
          employeeId: emp.id,
          source: 'device',
          direction: 'in',
        },
      });
      const punchOut = await prisma.biometricPunch.create({
        data: {
          organizationId: client.organizationId,
          biometricDeviceId: deviceOut.id,
          externalEventId: `${prefix}-OUT-${workYmd}-${emp.id.slice(-6)}`,
          observedAt: outAt,
          rawSubjectId: emp.employeeNumber ?? emp.id,
          employeeId: emp.id,
          source: 'device',
          direction: 'out',
        },
      });

      await prisma.attendanceEvent.create({
        data: {
          organizationId: client.organizationId,
          employeeId: emp.id,
          outsourcingClientId: clientId,
          observedAt: inAt,
          workDate,
          source: 'biometric',
          kind: 'check_in',
          biometricPunchId: punchIn.id,
          notes: 'demo-enrichment-punch',
        },
      });
      await prisma.attendanceEvent.create({
        data: {
          organizationId: client.organizationId,
          employeeId: emp.id,
          outsourcingClientId: clientId,
          observedAt: outAt,
          workDate,
          source: 'biometric',
          kind: 'check_out',
          biometricPunchId: punchOut.id,
          notes: 'demo-enrichment-punch',
        },
      });

      await prisma.attendanceDaySummary.upsert({
        where: { employeeId_workDate: { employeeId: emp.id, workDate } },
        update: {
          firstInAt: inAt,
          lastOutAt: outAt,
          minutesWorked: Math.max(0, Math.round((outAt.getTime() - inAt.getTime()) / 60000) - 60),
          lateMinutes: inMin > 50 ? inMin - 50 : 0,
          status: AttendanceSummaryStatus.reconciled,
        },
        create: {
          organizationId: client.organizationId,
          employeeId: emp.id,
          outsourcingClientId: clientId,
          workDate,
          firstInAt: inAt,
          lastOutAt: outAt,
          minutesWorked: Math.max(0, Math.round((outAt.getTime() - inAt.getTime()) / 60000) - 60),
          lateMinutes: inMin > 50 ? inMin - 50 : 0,
          undertimeMinutes: 0,
          overtimeMinutes: outMin > 15 ? outMin - 15 : 0,
          status: AttendanceSummaryStatus.reconciled,
        },
      });
    }
  }
}

async function seedInvoicesForAccountsClient(
  accountsClientId: string,
  organizationId: string,
  prefix: string,
  clientName: string,
) {
  const existingDemo = await prisma.accountsInvoice.findFirst({
    where: {
      clientId: accountsClientId,
      notes: { contains: '[demo-enrichment-invoice]' },
    },
  });
  if (existingDemo) return;

  const accountsClient = await prisma.accountsClient.findUnique({
    where: { id: accountsClientId },
    select: { nextInvoiceNumber: true },
  });
  if (!accountsClient) return;

  const maxInvoice = await prisma.accountsInvoice.aggregate({ _max: { invoiceNumber: true } });
  let nextNum = Math.max(accountsClient.nextInvoiceNumber || 1000, (maxInvoice._max.invoiceNumber ?? 1000) + 1);
  const specs: Array<{
    status: AccountsInvoiceStatus;
    daysAgo: number;
    dueIn: number;
    lines: Array<{ item: string; amount: string }>;
  }> = [
    {
      status: AccountsInvoiceStatus.paid,
      daysAgo: 45,
      dueIn: -15,
      lines: [
        { item: `Managed services — ${clientName}`, amount: '185000.00' },
        { item: 'Payroll administration', amount: '42000.00' },
      ],
    },
    {
      status: AccountsInvoiceStatus.unpaid,
      daysAgo: 5,
      dueIn: 25,
      lines: [
        { item: `Monthly retainer — ${clientName}`, amount: '210000.00' },
        { item: 'Attendance & biometric ops support', amount: '28000.00' },
      ],
    },
    {
      status: AccountsInvoiceStatus.partial,
      daysAgo: 20,
      dueIn: 10,
      lines: [
        { item: 'Pass-through disbursements', amount: '96000.00' },
        { item: 'Statutory filing support', amount: '15000.00' },
      ],
    },
  ];

  for (const spec of specs) {
    const issueDate = daysFromNow(-spec.daysAgo);
    const dueDate = daysFromNow(spec.dueIn);
    const invoice = await prisma.accountsInvoice.create({
      data: {
        organizationId,
        clientId: accountsClientId,
        invoiceNumber: nextNum,
        issueDate,
        dueDate,
        taxDate: issueDate,
        currency: 'KES',
        vatRateBps: 1600,
        status: spec.status,
        notes: `[demo-enrichment-invoice] ${prefix} demo invoice for ${clientName}`,
        lines: {
          create: spec.lines.map((l, idx) => ({
            organizationId,
            item: l.item,
            amountExVat: new Prisma.Decimal(l.amount),
            sortOrder: idx,
          })),
        },
      },
    });

    if (spec.status === AccountsInvoiceStatus.paid || spec.status === AccountsInvoiceStatus.partial) {
      const total = spec.lines.reduce((s, l) => s + parseFloat(l.amount), 0) * 1.16;
      const payAmount =
        spec.status === AccountsInvoiceStatus.paid ? total : Math.round(total * 0.4 * 100) / 100;
      const payment = await prisma.accountsClientPayment.create({
        data: {
          organizationId,
          clientId: accountsClientId,
          receivedAt: daysFromNow(-Math.max(1, spec.daysAgo - 5)),
          amount: new Prisma.Decimal(payAmount.toFixed(2)),
          reference: `MPESA-${prefix}-${nextNum}`,
          method: 'mpesa',
          notes: '[demo-enrichment-invoice] sample receipt',
        },
      });
      await prisma.accountsInvoicePaymentAllocation.create({
        data: {
          organizationId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: new Prisma.Decimal(payAmount.toFixed(2)),
        },
      });
    }

    nextNum += 1;
  }

  await prisma.accountsClient.update({
    where: { id: accountsClientId },
    data: { nextInvoiceNumber: nextNum },
  });
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
  organizationId: string,
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
      organizationId,
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
          organizationId,
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
        organizationId,
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
  // Interactive onboarding workflows time out on remote Neon (5s default). Skip unless forced.
  if (process.env.DEMO_SKIP_ONBOARDING_WORKFLOWS !== 'false') {
    console.log('  · onboarding workflows skipped (set DEMO_SKIP_ONBOARDING_WORKFLOWS=false to force)');
    return;
  }
  for (const employee of employees.slice(0, 2)) {
    const existing = await prisma.onboardingWorkflow.findFirst({
      where: { employeeId: employee.id, type: WorkflowType.ONBOARDING, status: WorkflowStatus.IN_PROGRESS },
    });
    if (!existing) {
      try {
        await startWorkflowForEmployee({ employeeId: employee.id, type: WorkflowType.ONBOARDING });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `  · onboarding skip for ${employee.firstName} ${employee.lastName}: ${message.slice(0, 160)}`,
        );
      }
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

  const sharedOrg = await prisma.organization.findUnique({
    where: { slug: 'demo-multi-vertical' },
    select: { id: true },
  });

  const showcaseCodes = VERTICAL_SHOWCASE_PACK_IDS.map((id) => `${id}__ke`);
  const keClientsRaw = await prisma.outsourcingClient.findMany({
    where: {
      entityCode: { in: showcaseCodes },
      ...(sharedOrg ? { organizationId: sharedOrg.id } : {}),
    },
    orderBy: { entityCode: 'asc' },
  });

  // One client per entityCode — prefer the row with active employees.
  const keClients = [] as typeof keClientsRaw;
  const byCode = new Map<string, (typeof keClientsRaw)[number][]>();
  for (const c of keClientsRaw) {
    const code = c.entityCode!;
    const list = byCode.get(code) ?? [];
    list.push(c);
    byCode.set(code, list);
  }
  for (const [, list] of byCode) {
    if (list.length === 1) {
      keClients.push(list[0]!);
      continue;
    }
    const withCounts = await Promise.all(
      list.map(async (c) => ({
        client: c,
        n: await prisma.employee.count({
          where: { outsourcingClientId: c.id, employmentStatus: 'active' },
        }),
      })),
    );
    withCounts.sort((a, b) => b.n - a.n);
    keClients.push(withCounts[0]!.client);
  }

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

    try {
      await runStep('onboarding', () => seedOnboardingForEntity(employees));
      await runStep('disciplinary', () =>
        seedDisciplinaryForEntity(entityCode, client.organizationId, employees, hrUser.id),
      );
      await runStep('payroll', () => backfillPayrollForEntity(client.id));
      await runStep('sector content', () =>
        seedSectorContent(entityCode, client.name, employees, hrUser.id),
      );
      await runStep('biometrics', () => seedBiometricForClient(client.id, entityCode));

      if (entityCode.startsWith('imara-sacco')) {
        await runStep('sacco engine', async () => {
          const { seedSaccoDemo } = await import('../scripts/seed-sacco-demo');
          await seedSaccoDemo(prisma, client.organizationId, client.id);
        });
      }

      if (entityCode.startsWith('hospital-healthcare')) {
        await runStep('healthcare engine', async () => {
          const { seedHealthcareDemo } = await import('../scripts/seed-healthcare-demo');
          await seedHealthcareDemo(prisma, client.organizationId, client.id);
        });
      }

      if (entityCode.startsWith('petroleum-retail')) {
        await runStep('energy engine', async () => {
          const { seedEnergyDemo } = await import('../scripts/seed-energy-demo');
          await seedEnergyDemo(prisma, client.organizationId, client.id);
        });
      }

      if (entityCode.startsWith('construction')) {
        await runStep('construction engine', async () => {
          const { seedConstructionVerticalDemo } = await import('../scripts/seed-construction-demo');
          await seedConstructionVerticalDemo(prisma, client.organizationId, client.id);
        });
      }

      const accountsClient = await prisma.accountsClient.findUnique({
        where: { outsourcingClientId: client.id },
      });
      if (accountsClient) {
        await runStep('contracts', () =>
          seedContractsForEntity(accountsClient.id, hrUser.id, entityPrefix(entityCode)),
        );
        await runStep('invoices', () =>
          seedInvoicesForAccountsClient(
            accountsClient.id,
            client.organizationId,
            entityPrefix(entityCode),
            client.name,
          ),
        );
      }

      console.log(
        `  ✓ ${client.name} — ${employees.length} staff, training, docs, payroll, contracts`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${client.name} enrichment partial failure: ${message.slice(0, 200)}`);
    }
  }
}

async function runStep(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  · ${label} skipped: ${message.slice(0, 160)}`);
  }
}

async function seedStaffLeaveDemo() {
  try {
    execSync('node prisma/seed-staff-leave.js', { cwd: root, stdio: 'inherit', env: process.env });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`→ Staff leave seed skipped: ${message.slice(0, 160)}`);
    return;
  }

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

  try {
    await prisma.staffLeaveApplication.create({
      data: {
        organizationId: annualType.organizationId,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`→ Staff leave application skipped: ${message.slice(0, 160)}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');

  console.log('\nEnriching all vertical showcase companies with full sector demo data…\n');

  execSync('npx tsx prisma/seed-onboarding-templates.ts', { cwd: root, stdio: 'inherit', env: process.env });
  await ensureAccountsClients();

  // Projects before construction engine so sites can attach projectId.
  execSync('npx tsx prisma/seed-projects-demo.ts', { cwd: root, stdio: 'inherit', env: process.env });
  await enrichShowcaseVerticals();

  console.log('\n→ Fleet demo for Savannah Freight (cargo-logistics)…');
  try {
    execSync('npx tsx prisma/seed-fleet-demo.ts', {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        FLEET_CLIENT_NAME: 'Savannah Freight & Logistics Ltd',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`→ Fleet demo skipped: ${message.slice(0, 200)}`);
  }

  console.log('\n→ Sales demo (cargo + travel pipeline)…');
  try {
    execSync('npx tsx prisma/seed-sales-demo.ts', {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SALES_THEME: 'both' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`→ Sales demo skipped: ${message.slice(0, 200)}`);
  }

  console.log('\n→ Industry depth (assets, HSE, procurement, performance per company)…');
  try {
    execSync('npx tsx prisma/seed-demo-industry-depth.ts', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`→ Industry depth skipped: ${message.slice(0, 200)}`);
  }

  await seedStaffLeaveDemo();

  console.log('\nAll vertical demos enriched.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
