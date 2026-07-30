/**
 * Seed multi-end-client security / manpower roster under demo-multi-vertical.
 * Clients use entityCode=null so they appear in Outsourcing, not the 6-company switcher.
 *
 * Tag: contractNotes includes [demo-security-bpo] (protected by orphan cleanup).
 *
 * Run: npx tsx prisma/seed-demo-security-bpo.ts
 */
import bcrypt from 'bcryptjs';
import {
  Prisma,
  PrismaClient,
  PayrollStatus,
  EssPortalRole,
  CredentialCategory,
  CredentialStatus,
  AttendanceSummaryStatus,
  AccountsInvoiceStatus,
} from '@prisma/client';
import { generateDemoStaffRows } from './demo-packs/generate-demo-staff';
import { d, daysFromToday } from './demo-packs/date-helpers';
import { calculateStatutoryForPayroll } from '../src/lib/payroll-calc';
import { SECURITY_BPO_MARKER, MULTI_VERTICAL_ORG_SLUG } from './demo-security-bpo-constants';

const prisma = new PrismaClient();

const DEPARTMENTS = ['Day Shift Guards', 'Night Shift Guards', 'Supervisors', 'Control Room'] as const;

type EndClientDef = {
  key: string;
  name: string;
  prefix: string;
  county: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  postalAddress: string;
  headcount: number;
  site: { name: string; lat: number; lng: number };
  serviceFeeAmount: number;
};

const END_CLIENTS: EndClientDef[] = [
  {
    key: 'westlands-mall',
    name: 'Westlands Mall Security',
    prefix: 'WMS',
    county: 'Nairobi',
    contactName: 'Faith Kamau',
    contactEmail: 'ops@westlandsmall.demo.ke',
    contactPhone: '+254 720 100101',
    postalAddress: 'Westlands Mall, Waiyaki Way, Nairobi',
    headcount: 28,
    site: { name: 'Westlands Mall — Main Gate', lat: -1.2675, lng: 36.8112 },
    serviceFeeAmount: 3500,
  },
  {
    key: 'two-rivers',
    name: 'Two Rivers Campus',
    prefix: 'TRC',
    county: 'Nairobi',
    contactName: 'Peter Odhiambo',
    contactEmail: 'security@tworivers.demo.ke',
    contactPhone: '+254 720 100102',
    postalAddress: 'Two Rivers, Limuru Road, Nairobi',
    headcount: 32,
    site: { name: 'Two Rivers — North Gate', lat: -1.2108, lng: 36.7935 },
    serviceFeeAmount: 3800,
  },
  {
    key: 'industrial-warehouse',
    name: 'Industrial Area Warehouse',
    prefix: 'IAW',
    county: 'Nairobi',
    contactName: 'James Mutiso',
    contactEmail: 'site@iawarehouse.demo.ke',
    contactPhone: '+254 720 100103',
    postalAddress: 'Enterprise Road, Industrial Area, Nairobi',
    headcount: 22,
    site: { name: 'IA Warehouse — Loading Bay', lat: -1.3089, lng: 36.855 },
    serviceFeeAmount: 3200,
  },
  {
    key: 'bank-branch',
    name: 'Bank Branch Network',
    prefix: 'BBN',
    county: 'Nairobi',
    contactName: 'Grace Wambui',
    contactEmail: 'facilities@banknet.demo.ke',
    contactPhone: '+254 720 100104',
    postalAddress: 'Kimathi Street banking corridor, Nairobi CBD',
    headcount: 36,
    site: { name: 'CBD Branch Cluster — HQ Post', lat: -1.2864, lng: 36.8172 },
    serviceFeeAmount: 4200,
  },
  {
    key: 'kitengela-estate',
    name: 'Residential Estate Kitengela',
    prefix: 'REK',
    county: 'Kajiado',
    contactName: 'Samuel Rotich',
    contactEmail: 'estate@kitengela.demo.ke',
    contactPhone: '+254 720 100105',
    postalAddress: 'Kitengela Bypass Estate, Kajiado',
    headcount: 18,
    site: { name: 'Kitengela Estate — Boom Gate', lat: -1.475, lng: 36.958 },
    serviceFeeAmount: 2800,
  },
  {
    key: 'hospital-night',
    name: 'Hospital Night Watch',
    prefix: 'HNW',
    county: 'Nairobi',
    contactName: 'Dr. Amina Hassan',
    contactEmail: 'estates@hospital.demo.ke',
    contactPhone: '+254 720 100106',
    postalAddress: 'Ngong Road medical campus, Nairobi',
    headcount: 24,
    site: { name: 'Hospital Campus — Emergency Gate', lat: -1.303, lng: 36.787 },
    serviceFeeAmount: 4000,
  },
  {
    key: 'airport-cargo',
    name: 'JKIA Cargo Perimeter',
    prefix: 'JCP',
    county: 'Nairobi',
    contactName: 'Daniel Barasa',
    contactEmail: 'perimeter@jkia-cargo.demo.ke',
    contactPhone: '+254 720 100107',
    postalAddress: 'JKIA Cargo Village, Embakasi',
    headcount: 30,
    site: { name: 'JKIA Cargo — Perimeter Post 3', lat: -1.3192, lng: 36.9275 },
    serviceFeeAmount: 4500,
  },
  {
    key: 'tech-park',
    name: 'Sameer Business Park',
    prefix: 'SBP',
    county: 'Nairobi',
    contactName: 'Lucy Chebet',
    contactEmail: 'facilities@sameerpark.demo.ke',
    contactPhone: '+254 720 100108',
    postalAddress: 'Sameer Business Park, Mombasa Road',
    headcount: 20,
    site: { name: 'Sameer Park — Lobby Desk', lat: -1.322, lng: 36.845 },
    serviceFeeAmount: 3600,
  },
];

const SHIFT_TEMPLATES = [
  { name: 'Day post', startMinutes: 6 * 60, endMinutes: 18 * 60, breakMinutes: 60, color: '#FF5436' },
  { name: 'Night post', startMinutes: 18 * 60, endMinutes: 6 * 60, breakMinutes: 45, color: '#1A1714' },
] as const;

function utcDay(delta: number) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + delta, 12, 0, 0));
}

function atUtc(ymd: string, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

function isoDate(d0: Date) {
  return d0.toISOString().slice(0, 10);
}

async function seedClient(
  orgId: string,
  def: EndClientDef,
  passwordHash: string,
): Promise<{ clientId: string; employeeCount: number }> {
  const existing = await prisma.outsourcingClient.findFirst({
    where: {
      organizationId: orgId,
      employeeNumberPrefix: def.prefix,
      contractNotes: { contains: SECURITY_BPO_MARKER },
    },
  });

  const client =
    existing ??
    (await prisma.outsourcingClient.create({
      data: {
        organizationId: orgId,
        name: def.name,
        status: 'active',
        entityCode: null,
        contactName: def.contactName,
        contactEmail: def.contactEmail,
        contactPhone: def.contactPhone,
        postalAddress: def.postalAddress,
        county: def.county,
        currency: 'KES',
        billingCycle: 'monthly',
        serviceFeeType: 'per_employee',
        serviceFeeAmount: new Prisma.Decimal(def.serviceFeeAmount),
        paymentTerms: 'Net 30',
        employeeNumberPrefix: def.prefix,
        payrollFrequency: 'monthly',
        contractStartDate: d(2024, 1, 1),
        contractNotes: `${SECURITY_BPO_MARKER} Manpower / guarding contract — demo end-client.`,
        kraPin: `P${def.prefix}0001K`,
        nssfEmployerNumber: `${def.prefix}-NSSF-EMP`,
      },
    }));

  if (existing) {
    await prisma.outsourcingClient.update({
      where: { id: client.id },
      data: {
        name: def.name,
        contactName: def.contactName,
        contactEmail: def.contactEmail,
        contactPhone: def.contactPhone,
        postalAddress: def.postalAddress,
        county: def.county,
        serviceFeeAmount: new Prisma.Decimal(def.serviceFeeAmount),
        contractNotes: `${SECURITY_BPO_MARKER} Manpower / guarding contract — demo end-client.`,
      },
    });
  }

  // Wipe prior workforce for this end-client so reseed is idempotent.
  await prisma.employee.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.department.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.shiftAssignment.deleteMany({
    where: { rotaPeriod: { outsourcingClientId: client.id } },
  });
  await prisma.rotaPeriod.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.shiftTemplate.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.biometricPunch.deleteMany({
    where: { device: { outsourcingClientId: client.id } },
  });
  await prisma.biometricDevice.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.attendanceEvent.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.attendanceDaySummary.deleteMany({ where: { outsourcingClientId: client.id } });
  await prisma.attendanceWorkSite.deleteMany({ where: { outsourcingClientId: client.id } });

  const deptIds = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const dept = await prisma.department.create({
      data: { organizationId: orgId, outsourcingClientId: client.id, name },
    });
    deptIds.set(name, dept.id);
  }

  const staff = generateDemoStaffRows({
    prefix: def.prefix,
    emailDomain: `${def.key}.security.demo.ke`,
    count: def.headcount,
    departments: DEPARTMENTS,
    startIndex: 1,
    baseSalary: 32000,
    roles: [
      'Security Guard',
      'Armed Response Guard',
      'Access Control Officer',
      'CCTV Controller',
      'Site Supervisor',
      'Patrol Guard',
      'Gate Marshal',
      'Night Watch Officer',
    ],
  });

  const employees: Array<{ id: string; email: string; employeeNumber: string | null; firstName: string; lastName: string; baseSalary: Prisma.Decimal }> = [];
  for (const emp of staff) {
    const departmentId = deptIds.get(emp.department) ?? null;
    const row = await prisma.employee.create({
      data: {
        organizationId: orgId,
        outsourcingClientId: client.id,
        departmentId,
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
        employmentStatus: 'active',
      },
    });
    employees.push(row);

    await prisma.employeeCredential.create({
      data: {
        organizationId: orgId,
        employeeId: row.id,
        category: CredentialCategory.regulatory_compliance,
        credentialName: 'Private Security Guard Licence',
        credentialNumber: `PSRA-${def.prefix}-${emp.employeeNumber.slice(-3)}`,
        issuingAuthority: 'Private Security Regulatory Authority',
        issueDate: daysFromToday(-400),
        expiryDate: daysFromToday(60 + (employees.length % 90)),
        status: employees.length % 11 === 0 ? CredentialStatus.expiring_soon : CredentialStatus.active,
        reminderDays: 30,
      },
    });
  }

  const site = await prisma.attendanceWorkSite.create({
    data: {
      organizationId: orgId,
      outsourcingClientId: client.id,
      name: def.site.name,
      latitude: def.site.lat,
      longitude: def.site.lng,
      radiusMeters: 150,
      isActive: true,
    },
  });

  const templateIds: string[] = [];
  for (const t of SHIFT_TEMPLATES) {
    const tpl = await prisma.shiftTemplate.create({
      data: {
        organizationId: orgId,
        outsourcingClientId: client.id,
        name: t.name,
        startMinutes: t.startMinutes,
        endMinutes: t.endMinutes,
        breakMinutes: t.breakMinutes,
        color: t.color,
        isActive: true,
      },
    });
    templateIds.push(tpl.id);
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const rota = await prisma.rotaPeriod.create({
    data: {
      organizationId: orgId,
      outsourcingClientId: client.id,
      name: `${now.toLocaleString('en-GB', { month: 'long' })} ${now.getUTCFullYear()} Guard Rota`,
      startDate: monthStart,
      endDate: monthEnd,
      status: 'published',
    },
  });

  // Assign first 12 guards across last 10 weekdays for dense rota optics.
  const assignPool = employees.slice(0, Math.min(12, employees.length));
  for (let dayOffset = -9; dayOffset <= 0; dayOffset++) {
    const day = utcDay(dayOffset);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const workYmd = isoDate(day);
    for (let i = 0; i < assignPool.length; i++) {
      const emp = assignPool[i]!;
      const tpl = SHIFT_TEMPLATES[i % SHIFT_TEMPLATES.length]!;
      const tplId = templateIds[i % templateIds.length]!;
      const startsAt = atUtc(
        workYmd,
        `${String(Math.floor(tpl.startMinutes / 60)).padStart(2, '0')}:${String(tpl.startMinutes % 60).padStart(2, '0')}`,
      );
      const endDay = new Date(day);
      if (tpl.endMinutes <= tpl.startMinutes) endDay.setUTCDate(endDay.getUTCDate() + 1);
      const endYmd = isoDate(endDay);
      const endsAt = atUtc(
        endYmd,
        `${String(Math.floor(tpl.endMinutes / 60)).padStart(2, '0')}:${String(tpl.endMinutes % 60).padStart(2, '0')}`,
      );
      await prisma.shiftAssignment.create({
        data: {
          organizationId: orgId,
          rotaPeriodId: rota.id,
          employeeId: emp.id,
          shiftTemplateId: tplId,
          workDate: new Date(`${workYmd}T00:00:00.000Z`),
          startsAt,
          endsAt,
          breakMinutes: tpl.breakMinutes,
        },
      });
    }
  }

  // Devices + punches + attendance for a sample of guards.
  const deviceIn = await prisma.biometricDevice.create({
    data: {
      organizationId: orgId,
      outsourcingClientId: client.id,
      name: `${def.prefix}-GATE-IN`,
      adapterKind: 'hikvision_isapi',
      config: { host: '10.40.1.10', port: 80, vendor: 'Hikvision', site: def.site.name },
      isActive: true,
      lastPollAt: daysFromToday(-1),
    },
  });
  const deviceOut = await prisma.biometricDevice.create({
    data: {
      organizationId: orgId,
      outsourcingClientId: client.id,
      name: `${def.prefix}-GATE-OUT`,
      adapterKind: 'hikvision_isapi',
      config: { host: '10.40.1.11', port: 80, vendor: 'Hikvision', site: def.site.name },
      isActive: true,
      lastPollAt: daysFromToday(-1),
    },
  });

  const punchPool = employees.slice(0, Math.min(8, employees.length));
  for (let dayOffset = -6; dayOffset <= -1; dayOffset++) {
    const day = utcDay(dayOffset);
    if (day.getUTCDay() === 0) continue;
    const workYmd = isoDate(day);
    for (let i = 0; i < punchPool.length; i++) {
      const emp = punchPool[i]!;
      const inAt = atUtc(workYmd, `05:${String(45 + (i % 10)).padStart(2, '0')}`);
      const outAt = atUtc(workYmd, `18:${String(5 + (i % 12)).padStart(2, '0')}`);
      const punchIn = await prisma.biometricPunch.create({
        data: {
          organizationId: orgId,
          biometricDeviceId: deviceIn.id,
          externalEventId: `${def.prefix}-IN-${workYmd}-${emp.id.slice(-6)}`,
          observedAt: inAt,
          rawSubjectId: emp.employeeNumber ?? emp.id,
          employeeId: emp.id,
          source: 'device',
          direction: 'in',
          rawPayload: { siteId: site.id, site: def.site.name },
        },
      });
      const punchOut = await prisma.biometricPunch.create({
        data: {
          organizationId: orgId,
          biometricDeviceId: deviceOut.id,
          externalEventId: `${def.prefix}-OUT-${workYmd}-${emp.id.slice(-6)}`,
          observedAt: outAt,
          rawSubjectId: emp.employeeNumber ?? emp.id,
          employeeId: emp.id,
          source: 'device',
          direction: 'out',
          rawPayload: { siteId: site.id, site: def.site.name },
        },
      });
      await prisma.attendanceEvent.create({
        data: {
          organizationId: orgId,
          employeeId: emp.id,
          outsourcingClientId: client.id,
          observedAt: inAt,
          workDate: new Date(`${workYmd}T00:00:00.000Z`),
          source: 'biometric',
          kind: 'check_in',
          biometricPunchId: punchIn.id,
        },
      });
      await prisma.attendanceEvent.create({
        data: {
          organizationId: orgId,
          employeeId: emp.id,
          outsourcingClientId: client.id,
          observedAt: outAt,
          workDate: new Date(`${workYmd}T00:00:00.000Z`),
          source: 'biometric',
          kind: 'check_out',
          biometricPunchId: punchOut.id,
        },
      });
      await prisma.attendanceDaySummary.upsert({
        where: {
          employeeId_workDate: {
            employeeId: emp.id,
            workDate: new Date(`${workYmd}T00:00:00.000Z`),
          },
        },
        update: {
          firstInAt: inAt,
          lastOutAt: outAt,
          minutesWorked: 12 * 60 - 60,
          lateMinutes: i % 4 === 0 ? 8 : 0,
          status: AttendanceSummaryStatus.reconciled,
        },
        create: {
          organizationId: orgId,
          employeeId: emp.id,
          outsourcingClientId: client.id,
          workDate: new Date(`${workYmd}T00:00:00.000Z`),
          firstInAt: inAt,
          lastOutAt: outAt,
          minutesWorked: 12 * 60 - 60,
          lateMinutes: i % 4 === 0 ? 8 : 0,
          undertimeMinutes: 0,
          overtimeMinutes: 0,
          status: AttendanceSummaryStatus.reconciled,
        },
      });
    }
  }

  // Payroll: previous month approved + current draft for all guards.
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  for (const monthData of [
    { month: prevMonth, year: prevYear, status: PayrollStatus.approved },
    { month: currentMonth, year: currentYear, status: PayrollStatus.draft },
  ]) {
    for (const emp of employees) {
      const basic = Number(emp.baseSalary);
      const allowances = [{ name: 'Risk', amount: 4000 }, { name: 'Night', amount: 2500 }];
      const employmentGross = basic + allowances.reduce((s, a) => s + a.amount, 0);
      const statutory = calculateStatutoryForPayroll('none', employmentGross, 0, 0);
      await prisma.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month: monthData.month,
            year: monthData.year,
          },
        },
        update: {
          basicPay: new Prisma.Decimal(basic),
          allowances: allowances as unknown as Prisma.JsonArray,
          deductions: [] as unknown as Prisma.JsonArray,
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
          organizationId: orgId,
          employeeId: emp.id,
          month: monthData.month,
          year: monthData.year,
          basicPay: new Prisma.Decimal(basic),
          allowances: allowances as unknown as Prisma.JsonArray,
          deductions: [] as unknown as Prisma.JsonArray,
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

  // ESS for flagship Westlands first guard.
  if (def.key === 'westlands-mall' && employees[0]) {
    const hero = employees[0];
    const essEmail = 'guard.demo@westlands.security.demo.ke';
    await prisma.essPortalUser.upsert({
      where: { email: essEmail },
      update: {
        organizationId: orgId,
        passwordHash,
        name: `${hero.firstName} ${hero.lastName}`,
        employeeId: hero.id,
        role: EssPortalRole.employee,
        isActive: true,
        mustResetPassword: false,
      },
      create: {
        organizationId: orgId,
        email: essEmail,
        name: `${hero.firstName} ${hero.lastName}`,
        passwordHash,
        employeeId: hero.id,
        role: EssPortalRole.employee,
        isActive: true,
        mustResetPassword: false,
      },
    });
  }

  return { clientId: client.id, employeeCount: employees.length };
}

export async function seedDemoSecurityBpo() {
  const org = await prisma.organization.findUnique({
    where: { slug: MULTI_VERTICAL_ORG_SLUG },
    select: { id: true },
  });
  if (!org) {
    console.warn(`Org ${MULTI_VERTICAL_ORG_SLUG} missing — skip security BPO seed.`);
    return;
  }

  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD || process.env.STAFF_PASSWORD || 'Demo@2026!';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('\n→ Security / manpower end-clients (null entityCode)…');
  let totalGuards = 0;
  for (const def of END_CLIENTS) {
    const result = await seedClient(org.id, def, passwordHash);
    totalGuards += result.employeeCount;
    console.log(`   · ${def.name}: ${result.employeeCount} guards`);
  }

  // Sync billing profiles for new end-clients + light invoices on flagship clients.
  const { syncLinkedBillingClients } = await import('./lib/sync-linked-billing-clients.js');
  await syncLinkedBillingClients(prisma);

  const invoiceTargets = END_CLIENTS.slice(0, 3);
  for (const def of invoiceTargets) {
    const oc = await prisma.outsourcingClient.findFirst({
      where: {
        organizationId: org.id,
        employeeNumberPrefix: def.prefix,
        contractNotes: { contains: SECURITY_BPO_MARKER },
      },
      select: { id: true, name: true },
    });
    if (!oc) continue;
    const ac = await prisma.accountsClient.findUnique({
      where: { outsourcingClientId: oc.id },
      select: { id: true, nextInvoiceNumber: true },
    });
    if (!ac) continue;
    const hasDemoInvoice = await prisma.accountsInvoice.findFirst({
      where: { clientId: ac.id, notes: { contains: '[demo-security-invoice]' } },
    });
    if (hasDemoInvoice) continue;

    const maxInvoice = await prisma.accountsInvoice.aggregate({ _max: { invoiceNumber: true } });
    let nextNum = Math.max(ac.nextInvoiceNumber || 2000, (maxInvoice._max.invoiceNumber ?? 2000) + 1);
    const invoice = await prisma.accountsInvoice.create({
      data: {
        organizationId: org.id,
        clientId: ac.id,
        invoiceNumber: nextNum,
        issueDate: daysFromToday(-3),
        dueDate: daysFromToday(27),
        currency: 'KES',
        vatRateBps: 1600,
        status: AccountsInvoiceStatus.unpaid,
        notes: `[demo-security-invoice] Guarding services — ${def.name}`,
        lines: {
          create: [
            {
              organizationId: org.id,
              item: `Guarding — ${def.headcount} posts × monthly`,
              amountExVat: new Prisma.Decimal(def.headcount * def.serviceFeeAmount),
              sortOrder: 0,
            },
            {
              organizationId: org.id,
              item: 'Supervisor & control-room cover',
              amountExVat: new Prisma.Decimal(45000),
              sortOrder: 1,
            },
          ],
        },
      },
    });
    void invoice;
    await prisma.accountsClient.update({
      where: { id: ac.id },
      data: { nextInvoiceNumber: nextNum + 1 },
    });
  }

  console.log(
    `→ Security BPO seeded: ${END_CLIENTS.length} end-clients, ${totalGuards} guards. ESS: guard.demo@westlands.security.demo.ke`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  await seedDemoSecurityBpo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
