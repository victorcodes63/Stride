/**
 * ESS showcase seed — fill empty ESS surfaces for the cargo/SwiftFreight demo employee (Moses).
 * Idempotent; safe to re-run. Tied to existing demo content (same org, client, pay, leave types).
 *
 * Prefer after `npm run db:seed-all-demo`:
 *   DEMO_PACK=cargo-logistics npx tsx prisma/seed-ess-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ESS_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_ESS_EMAIL?.trim().toLowerCase() ||
  'moses.okello@swiftfreight.imara.co.ke';

function daysFromToday(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function atUtc(ymd: string, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const essUser = await prisma.essPortalUser.findFirst({
    where: { email: { equals: ESS_EMAIL, mode: 'insensitive' } },
  });
  if (!essUser) {
    throw new Error(`No EssPortalUser for ${ESS_EMAIL}. Run cargo seed-demo first.`);
  }

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: { equals: ESS_EMAIL, mode: 'insensitive' } },
        essUser.employeeId ? { id: essUser.employeeId } : { id: '__none__' },
      ],
    },
  });
  if (!employee) {
    throw new Error(`No Employee linked for ${ESS_EMAIL}.`);
  }

  const organizationId = employee.organizationId;
  const clientId = employee.outsourcingClientId;

  const hrUser =
    (await prisma.user.findFirst({
      where: { isActive: true, email: { contains: 'hr@' } },
    })) ||
    (await prisma.user.findFirst({
      where: { isActive: true, email: { contains: 'admin@' } },
    })) ||
    (await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));

  if (!hrUser) {
    throw new Error('Need at least one staff User to attach uploadedBy on documents.');
  }

  console.log(`[seed-ess-demo] Enriching ESS for ${employee.firstName} ${employee.lastName} (${ESS_EMAIL})`);

  // ── Leave types for THIS org (demo pack sometimes attaches other-org types) ──
  const leaveTypeDefs = [
    { name: 'Annual Leave', daysPerYear: 21 },
    { name: 'Sick Leave', daysPerYear: 14 },
    { name: 'Compassionate Leave', daysPerYear: 5 },
    { name: 'Maternity Leave', daysPerYear: 90 },
    { name: 'Paternity Leave', daysPerYear: 14 },
    { name: 'Study Leave', daysPerYear: 0 },
    { name: 'Unpaid Leave', daysPerYear: 0 },
  ];
  const leaveTypeIdByName = new Map<string, string>();
  for (const def of leaveTypeDefs) {
    const existing = await prisma.leaveType.findFirst({
      where: { organizationId, name: def.name },
    });
    if (existing) {
      await prisma.leaveType.update({
        where: { id: existing.id },
        data: { daysPerYear: def.daysPerYear },
      });
      leaveTypeIdByName.set(def.name, existing.id);
    } else {
      const created = await prisma.leaveType.create({
        data: { organizationId, name: def.name, daysPerYear: def.daysPerYear },
      });
      leaveTypeIdByName.set(def.name, created.id);
    }
  }
  console.log(`  leave types: ${leaveTypeIdByName.size}`);

  const year = new Date().getUTCFullYear();
  for (const name of ['Annual Leave', 'Sick Leave'] as const) {
    const leaveTypeId = leaveTypeIdByName.get(name)!;
    const daysPerYear = leaveTypeDefs.find((d) => d.name === name)!.daysPerYear;
    const existing = await prisma.leaveBalance.findFirst({
      where: { employeeId: employee.id, year, leaveType: { name } },
    });
    if (existing) {
      await prisma.leaveBalance.update({
        where: { id: existing.id },
        data: {
          leaveTypeId,
          organizationId,
          balance: existing.balance > 0 ? existing.balance : daysPerYear,
        },
      });
    } else {
      await prisma.leaveBalance.create({
        data: {
          organizationId,
          employeeId: employee.id,
          leaveTypeId,
          year,
          balance: daysPerYear,
          used: 0,
        },
      });
    }
  }

  // Re-point any Moses applications that still use foreign-org leave types
  const mosesApps = await prisma.leaveApplication.findMany({
    where: { employeeId: employee.id },
    include: { leaveType: { select: { name: true, organizationId: true } } },
  });
  for (const app of mosesApps) {
    if (app.leaveType.organizationId === organizationId) continue;
    const mappedId = leaveTypeIdByName.get(app.leaveType.name) ?? leaveTypeIdByName.get('Annual Leave');
    if (!mappedId) continue;
    await prisma.leaveApplication.update({
      where: { id: app.id },
      data: { leaveTypeId: mappedId, organizationId },
    });
  }
  console.log(`  leave balances + apps remapped for org`);

  // ── Attendance: last 10 weekdays this month ─────────────────────────
  let attendanceCount = 0;
  for (let i = 1; i <= 14; i += 1) {
    const day = daysFromToday(-i);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (attendanceCount >= 10) break;
    const ymd = isoDate(day);
    const workDate = new Date(`${ymd}T00:00:00.000Z`);
    const checkIn = atUtc(ymd, '07:45');
    const checkOut = atUtc(ymd, '19:30');
    const minutesWorked = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: workDate } },
      update: {
        checkIn,
        checkOut,
        notes: 'Mombasa corridor long-haul day',
      },
      create: {
        organizationId,
        employeeId: employee.id,
        date: workDate,
        checkIn,
        checkOut,
        notes: 'Mombasa corridor long-haul day',
      },
    });

    await prisma.attendanceDaySummary.upsert({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      update: {
        firstInAt: checkIn,
        lastOutAt: checkOut,
        minutesWorked,
        lateMinutes: 0,
        overtimeMinutes: Math.max(0, minutesWorked - 8 * 60),
        status: 'reconciled',
      },
      create: {
        organizationId,
        employeeId: employee.id,
        outsourcingClientId: clientId,
        workDate,
        firstInAt: checkIn,
        lastOutAt: checkOut,
        minutesWorked,
        lateMinutes: 0,
        overtimeMinutes: Math.max(0, minutesWorked - 8 * 60),
        holidayOvertimeMinutes: 0,
        status: 'reconciled',
      },
    });
    attendanceCount += 1;
  }
  console.log(`  attendance days: ${attendanceCount}`);

  // ── Future rota (next 14 weekdays) ──────────────────────────────────
  const template =
    (await prisma.shiftTemplate.findFirst({
      where: { outsourcingClientId: clientId, name: { contains: 'Depot' } },
    })) ||
    (await prisma.shiftTemplate.findFirst({ where: { outsourcingClientId: clientId } }));

  let rota = await prisma.rotaPeriod.findFirst({
    where: {
      outsourcingClientId: clientId,
      status: 'published',
      endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
  });

  if (!rota && template) {
    const start = daysFromToday(0);
    const end = daysFromToday(28);
    rota = await prisma.rotaPeriod.create({
      data: {
        organizationId,
        outsourcingClientId: clientId,
        name: `ESS showcase rota ${isoDate(start)}`,
        startDate: new Date(`${isoDate(start)}T00:00:00.000Z`),
        endDate: new Date(`${isoDate(end)}T00:00:00.000Z`),
        status: 'published',
      },
    });
  }

  let shiftCount = 0;
  if (rota && template) {
    for (let i = 1; i <= 21; i += 1) {
      const day = daysFromToday(i);
      const dow = day.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (shiftCount >= 10) break;
      const ymd = isoDate(day);
      const workDate = new Date(`${ymd}T00:00:00.000Z`);
      const startsAt = atUtc(ymd, '06:00');
      const endsAt = atUtc(ymd, '18:00');
      const existing = await prisma.shiftAssignment.findFirst({
        where: { employeeId: employee.id, workDate },
      });
      if (existing) {
        await prisma.shiftAssignment.update({
          where: { id: existing.id },
          data: {
            rotaPeriodId: rota.id,
            shiftTemplateId: template.id,
            startsAt,
            endsAt,
            breakMinutes: 60,
            notes: 'Mombasa outbound — ESS demo',
          },
        });
      } else {
        await prisma.shiftAssignment.create({
          data: {
            organizationId,
            rotaPeriodId: rota.id,
            employeeId: employee.id,
            shiftTemplateId: template.id,
            workDate,
            startsAt,
            endsAt,
            breakMinutes: 60,
            notes: 'Mombasa outbound — ESS demo',
          },
        });
      }
      shiftCount += 1;
    }
  }
  console.log(`  future shifts: ${shiftCount}`);

  // ── Employee documents ──────────────────────────────────────────────
  const docs = [
    {
      title: 'Driver employment contract — SFE',
      category: 'CONTRACT' as const,
      fileName: 'moses-okello-contract.pdf',
      filePath: `/demo/documents/moses-okello-contract.pdf`,
      documentNumber: 'SFE-CTR-001',
      isVerified: true,
    },
    {
      title: 'National ID — certified copy',
      category: 'IDENTIFICATION' as const,
      fileName: 'moses-okello-id.pdf',
      filePath: `/demo/documents/moses-okello-id.pdf`,
      documentNumber: 'ID-28401938',
      isVerified: true,
    },
    {
      title: 'Medical fitness certificate',
      category: 'MEDICAL' as const,
      fileName: 'moses-okello-medical.pdf',
      filePath: `/demo/documents/moses-okello-medical.pdf`,
      documentNumber: 'MED-2026-044',
      isVerified: false,
    },
  ];

  for (const doc of docs) {
    const existing = await prisma.employeeDocument.findFirst({
      where: { employeeId: employee.id, title: doc.title },
    });
    if (existing) {
      await prisma.employeeDocument.update({
        where: { id: existing.id },
        data: { ...doc, uploadedBy: hrUser.id },
      });
    } else {
      await prisma.employeeDocument.create({
        data: {
          organizationId,
          employeeId: employee.id,
          uploadedBy: hrUser.id,
          issuedOn: daysFromToday(-120),
          ...doc,
        },
      });
    }
  }
  console.log(`  documents: ${docs.length}`);

  // ── Assigned assets ─────────────────────────────────────────────────
  const assets = [
    {
      assetTag: 'SFE-PHONE-MO-01',
      name: 'Driver handset — Samsung A15',
      category: 'mobile_device' as const,
      serialNumber: 'R58T90MOSES1',
      manufacturer: 'Samsung',
      model: 'Galaxy A15',
    },
    {
      assetTag: 'SFE-PPE-MO-01',
      name: 'Hi-vis vest + safety boots set',
      category: 'uniform_ppe' as const,
      serialNumber: null,
      manufacturer: 'SafeTrack',
      model: 'Corridor kit',
    },
  ];

  for (const asset of assets) {
    await prisma.companyAsset.upsert({
      where: {
        outsourcingClientId_assetTag: {
          outsourcingClientId: clientId,
          assetTag: asset.assetTag,
        },
      },
      update: {
        name: asset.name,
        category: asset.category,
        status: 'assigned',
        assignedEmployeeId: employee.id,
        assignedAt: daysFromToday(-40),
        assignedByUserId: hrUser.id,
        serialNumber: asset.serialNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        location: 'Fleet & Drivers — Mombasa corridor',
      },
      create: {
        organizationId,
        outsourcingClientId: clientId,
        assetTag: asset.assetTag,
        name: asset.name,
        category: asset.category,
        status: 'assigned',
        assignedEmployeeId: employee.id,
        assignedAt: daysFromToday(-40),
        assignedByUserId: hrUser.id,
        serialNumber: asset.serialNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        location: 'Fleet & Drivers — Mombasa corridor',
      },
    });
  }
  console.log(`  assets: ${assets.length}`);

  // ── Grievance (on Moses) ────────────────────────────────────────────
  const grievanceNumber = `GR-${year}-ESS-MO`;
  await prisma.grievance.deleteMany({ where: { grievanceNumber } });
  await prisma.grievance.create({
    data: {
      organizationId,
      employeeId: employee.id,
      grievanceNumber,
      status: 'SUBMITTED',
      category: 'WORKPLACE_SAFETY',
      subject: 'Rest-bay lighting on Mombasa corridor layovers',
      description:
        'Night layover rest bays near Mariakani have poor lighting. Requesting review before the next peak season rotation.',
      submittedAt: daysFromToday(-3),
    },
  });
  console.log('  grievance: 1');

  // ── HSE near-miss ───────────────────────────────────────────────────
  const incidentNumber = `HSE-${year}-ESS-MO-01`;
  await prisma.hseIncident.deleteMany({
    where: { outsourcingClientId: clientId, incidentNumber },
  });
  await prisma.hseIncident.create({
    data: {
      organizationId,
      outsourcingClientId: clientId,
      incidentNumber,
      title: 'Near-miss — unmarked roadworks on A109',
      description:
        'Unmarked roadworks forced an emergency lane change near Voi. No injury. Reported for route briefing update.',
      incidentType: 'near_miss',
      severity: 'medium',
      status: 'open',
      location: 'A109 — Voi approach',
      siteName: 'Mombasa corridor',
      occurredAt: daysFromToday(-5),
      reportedByEmployeeId: employee.id,
      createdByUserId: hrUser.id,
    },
  });
  console.log('  hse incident: 1');

  // ── Notifications ───────────────────────────────────────────────────
  await prisma.staffNotification.deleteMany({
    where: {
      essPortalUserId: essUser.id,
      event: { in: ['ess.demo.payslip', 'ess.demo.leave', 'ess.demo.credential'] },
    },
  });
  await prisma.staffNotification.createMany({
    data: [
      {
        organizationId,
        essPortalUserId: essUser.id,
        title: 'July payslip is ready',
        body: 'Your July 2026 payslip has been published. Open Payslips to download the PDF.',
        href: '/ess/payslips',
        event: 'ess.demo.payslip',
        priority: 'info',
      },
      {
        organizationId,
        essPortalUserId: essUser.id,
        title: 'Leave request received',
        body: 'HR has your pending sick-leave request. You will be notified when it is decided.',
        href: '/ess/leave',
        event: 'ess.demo.leave',
        priority: 'info',
      },
      {
        organizationId,
        essPortalUserId: essUser.id,
        title: 'PSV badge expiring soon',
        body: 'Your goods-vehicle PSV badge expires within 30 days. Upload renewal docs via Credentials.',
        href: '/ess/credentials',
        event: 'ess.demo.credential',
        priority: 'warning',
      },
    ],
  });
  console.log('  notifications: 3');

  // ── Approved leave history (so leave list is not only pending) ──────
  const annual = await prisma.leaveType.findFirst({
    where: {
      OR: [
        { name: { contains: 'Annual', mode: 'insensitive' } },
        { name: { contains: 'Leave', mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
  });
  if (annual) {
    const start = daysFromToday(-45);
    const end = daysFromToday(-43);
    const existingApp = await prisma.leaveApplication.findFirst({
      where: {
        employeeId: employee.id,
        reason: 'Family visit — ESS demo history',
      },
    });
    if (!existingApp) {
      await prisma.leaveApplication.create({
        data: {
          organizationId,
          employeeId: employee.id,
          leaveTypeId: annual.id,
          startDate: new Date(`${isoDate(start)}T00:00:00.000Z`),
          endDate: new Date(`${isoDate(end)}T00:00:00.000Z`),
          days: 3,
          status: 'approved',
          reason: 'Family visit — ESS demo history',
        },
      });
      console.log('  approved leave history: 1');
    } else {
      console.log('  approved leave history: already present');
    }
  } else {
    console.log('  approved leave history: skipped (no leave type)');
  }

  console.log('[seed-ess-demo] Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
