/**
 * Eagle HR internal-team leave demo seed (idempotent).
 * Run: npm run db:seed-demo
 * Requires: DATABASE_URL, migrations applied (incl. leaveApproverId).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');

const prisma = new PrismaClient();
const EMAIL_DOMAIN = 'eaglehr.co.ke';
const DEMO_PASSWORD = process.env.DEMO_INTERNAL_PASSWORD || 'Demo2026!';
const DEMO_TAG = '[DemoSeed]';
const ROUNDS = 10;

const DEMO_USERS = [
  {
    email: 'admin@eaglehr.co.ke',
    name: 'Amina Njeri',
    role: 'admin',
    staffUserType: 'director',
    leaveApproverId: null,
  },
  {
    email: 'wanjiku.mwangi@eaglehr.co.ke',
    name: 'Wanjiku Mwangi',
    role: 'staff',
    staffUserType: 'business_manager',
    leaveApproverId: null,
  },
  {
    email: 'james.otieno@eaglehr.co.ke',
    name: 'James Otieno',
    role: 'staff',
    staffUserType: 'operations',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'grace.kamau@eaglehr.co.ke',
    name: 'Grace Kamau',
    role: 'staff',
    staffUserType: 'finance',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'peter.ndungu@eaglehr.co.ke',
    name: 'Peter Ndungu',
    role: 'staff',
    staffUserType: 'operations',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'sarah.wanjiru@eaglehr.co.ke',
    name: 'Sarah Wanjiru',
    role: 'staff',
    staffUserType: 'operations',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'daniel.ochieng@eaglehr.co.ke',
    name: 'Daniel Ochieng',
    role: 'staff',
    staffUserType: 'operations',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'michael.kibet@eaglehr.co.ke',
    name: 'Michael Kibet',
    role: 'staff',
    staffUserType: 'operations',
    reportTo: 'wanjiku.mwangi@eaglehr.co.ke',
  },
  {
    email: 'faith.mutua@eaglehr.co.ke',
    name: 'Faith Mutua',
    role: 'staff',
    staffUserType: 'director',
    reportTo: 'admin@eaglehr.co.ke',
  },
];

function workingDaysBetween(start, end) {
  const s = new Date(start);
  s.setHours(12, 0, 0, 0);
  const e = new Date(end);
  e.setHours(12, 0, 0, 0);
  if (e < s) return 0;
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function ensureLeaveTypes() {
  execSync('node prisma/seed-staff-leave.js', { stdio: 'inherit', env: process.env });
}

async function syncBalancesForDemoUsers(userIds, year) {
  for (const userId of userIds) {
    const balances = await prisma.staffLeaveBalance.findMany({
      where: { userId, year },
      select: { id: true, leaveTypeId: true },
    });
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    for (const bal of balances) {
      const agg = await prisma.staffLeaveApplication.aggregate({
        where: {
          userId,
          leaveTypeId: bal.leaveTypeId,
          status: 'approved',
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { totalDays: true },
      });
      await prisma.staffLeaveBalance.update({
        where: { id: bal.id },
        data: { usedDays: agg._sum.totalDays ?? 0 },
      });
    }
  }
}

async function upsertDemoApplication({
  key,
  userId,
  leaveTypeId,
  startDate,
  endDate,
  status,
  reason,
  approverId,
}) {
  const totalDays = workingDaysBetween(startDate, endDate);
  const taggedReason = `${DEMO_TAG}:${key} ${reason || ''}`.trim();

  const existing = await prisma.staffLeaveApplication.findFirst({
    where: { userId, reason: { startsWith: `${DEMO_TAG}:${key}` } },
  });

  const data = {
    userId,
    leaveTypeId,
    startDate,
    endDate,
    totalDays,
    reason: taggedReason,
    status,
    approvalState: status === 'pending' ? 'pending' : status,
    reviewedById: ['approved', 'rejected'].includes(status) ? approverId : null,
    reviewedAt: ['approved', 'rejected'].includes(status) ? new Date() : null,
    currentStepOrder: 1,
  };

  let app;
  if (existing) {
    app = await prisma.staffLeaveApplication.update({ where: { id: existing.id }, data });
    await prisma.leaveApprovalStep.deleteMany({ where: { staffLeaveApplicationId: app.id } });
    await prisma.leaveApprovalAction.deleteMany({ where: { staffLeaveApplicationId: app.id } });
  } else {
    app = await prisma.staffLeaveApplication.create({ data });
  }

  if (status === 'pending' && approverId) {
    await prisma.leaveApprovalStep.create({
      data: {
        staffLeaveApplicationId: app.id,
        stepOrder: 1,
        approverUserId: approverId,
        status: 'pending',
      },
    });
    await prisma.leaveApprovalAction.create({
      data: {
        staffLeaveApplicationId: app.id,
        actorUserId: userId,
        action: 'submitted',
        note: reason,
      },
    });
  }

  if (status === 'approved' && approverId) {
    await prisma.leaveApprovalStep.create({
      data: {
        staffLeaveApplicationId: app.id,
        stepOrder: 1,
        approverUserId: approverId,
        status: 'approved',
        actedAt: new Date(),
      },
    });
    await prisma.leaveApprovalAction.create({
      data: {
        staffLeaveApplicationId: app.id,
        actorUserId: approverId,
        action: 'approved',
      },
    });
  }

  if (status === 'rejected' && approverId) {
    await prisma.leaveApprovalStep.create({
      data: {
        staffLeaveApplicationId: app.id,
        stepOrder: 1,
        approverUserId: approverId,
        status: 'rejected',
        actedAt: new Date(),
      },
    });
    await prisma.leaveApprovalAction.create({
      data: {
        staffLeaveApplicationId: app.id,
        actorUserId: approverId,
        action: 'rejected',
        note: 'Peak period — please reschedule',
      },
    });
  }

  if (status === 'cancelled') {
    await prisma.leaveApprovalAction.create({
      data: {
        staffLeaveApplicationId: app.id,
        actorUserId: userId,
        action: 'cancelled',
        note: 'Plans changed',
      },
    });
  }

  return app;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, ROUNDS);
  const idByEmail = {};

  console.log('→ Upserting Eagle HR demo staff users…');
  for (const row of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: row.email },
      update: {
        name: row.name,
        passwordHash,
        role: row.role,
        staffUserType: row.staffUserType,
        isActive: true,
      },
      create: {
        email: row.email,
        name: row.name,
        passwordHash,
        role: row.role,
        staffUserType: row.staffUserType,
        isActive: true,
      },
    });
    idByEmail[row.email] = user.id;
  }

  for (const row of DEMO_USERS) {
    if (!row.reportTo) continue;
    const approverId = idByEmail[row.reportTo];
    if (!approverId) continue;
    await prisma.user.update({
      where: { email: row.email },
      data: { leaveApproverId: approverId },
    });
  }

  console.log('→ Leave types + balances…');
  await ensureLeaveTypes();

  const year = new Date().getFullYear();
  const demoUserIds = Object.values(idByEmail);
  const annualType = await prisma.staffLeaveType.findFirst({
    where: { name: { contains: 'Annual', mode: 'insensitive' }, active: true },
  });
  const sickType = await prisma.staffLeaveType.findFirst({
    where: { name: { contains: 'Sick', mode: 'insensitive' }, active: true },
  });
  if (!annualType) throw new Error('Annual leave type missing — run seed-staff-leave first');

  const approverId = idByEmail['wanjiku.mwangi@eaglehr.co.ke'];
  const adminId = idByEmail['admin@eaglehr.co.ke'];
  const staffId = idByEmail['james.otieno@eaglehr.co.ke'];
  const peterId = idByEmail['peter.ndungu@eaglehr.co.ke'];
  const sarahId = idByEmail['sarah.wanjiru@eaglehr.co.ke'];
  const danielId = idByEmail['daniel.ochieng@eaglehr.co.ke'];
  const graceId = idByEmail['grace.kamau@eaglehr.co.ke'];

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  console.log('→ Demo leave applications…');

  // Peter — 3 days approved earlier in year
  await upsertDemoApplication({
    key: 'peter-approved',
    userId: peterId,
    leaveTypeId: annualType.id,
    startDate: addDays(new Date(year, 2, 10), 0),
    endDate: addDays(new Date(year, 2, 10), 2),
    status: 'approved',
    reason: 'Family visit upcountry',
    approverId,
  });

  // Sarah — 2 days approved
  await upsertDemoApplication({
    key: 'sarah-approved',
    userId: sarahId,
    leaveTypeId: annualType.id,
    startDate: addDays(new Date(year, 4, 6), 0),
    endDate: addDays(new Date(year, 4, 6), 1),
    status: 'approved',
    reason: 'Personal errands',
    approverId,
  });

  // Daniel — 5 days approved
  await upsertDemoApplication({
    key: 'daniel-approved',
    userId: danielId,
    leaveTypeId: annualType.id,
    startDate: addDays(new Date(year, 1, 17), 0),
    endDate: addDays(new Date(year, 1, 17), 4),
    status: 'approved',
    reason: 'Annual break',
    approverId,
  });

  // Grace — 2 days approved (finance)
  await upsertDemoApplication({
    key: 'grace-approved',
    userId: graceId,
    leaveTypeId: annualType.id,
    startDate: addDays(new Date(year, 5, 2), 0),
    endDate: addDays(new Date(year, 5, 2), 1),
    status: 'approved',
    reason: 'Medical appointment',
    approverId,
  });

  // Pending — demo-staff (shows Approvals badge)
  await upsertDemoApplication({
    key: 'staff-pending',
    userId: staffId,
    leaveTypeId: annualType.id,
    startDate: addDays(today, 14),
    endDate: addDays(today, 16),
    status: 'pending',
    reason: 'Short break — client site visit postponed',
    approverId,
  });

  // Approved 1-day this month — Michael
  const michaelId = idByEmail['michael.kibet@eaglehr.co.ke'];
  await upsertDemoApplication({
    key: 'michael-this-month',
    userId: michaelId,
    leaveTypeId: annualType.id,
    startDate: addDays(monthStart, 4),
    endDate: addDays(monthStart, 4),
    status: 'approved',
    reason: 'Half-day personal',
    approverId,
  });

  // Cancelled 3-day request — never approved
  await upsertDemoApplication({
    key: 'peter-cancelled',
    userId: peterId,
    leaveTypeId: annualType.id,
    startDate: addDays(today, 30),
    endDate: addDays(today, 32),
    status: 'cancelled',
    reason: 'Travel plans changed',
    approverId: null,
  });

  // Rejected historical
  await upsertDemoApplication({
    key: 'daniel-rejected',
    userId: danielId,
    leaveTypeId: annualType.id,
    startDate: addDays(new Date(year, 7, 12), 0),
    endDate: addDays(new Date(year, 7, 12), 2),
    status: 'rejected',
    reason: 'Requested during month-end close',
    approverId,
  });

  // Upcoming approved — Sarah, 2–4 weeks out
  await upsertDemoApplication({
    key: 'sarah-upcoming',
    userId: sarahId,
    leaveTypeId: annualType.id,
    startDate: addDays(today, 18),
    endDate: addDays(today, 20),
    status: 'approved',
    reason: 'Planned long weekend',
    approverId,
  });

  if (sickType) {
    await upsertDemoApplication({
      key: 'james-sick',
      userId: staffId,
      leaveTypeId: sickType.id,
      startDate: addDays(new Date(year, 0, 8), 0),
      endDate: addDays(new Date(year, 0, 8), 0),
      status: 'approved',
      reason: 'Flu',
      approverId: adminId,
    });
  }

  console.log('→ Syncing usedDays from approved applications only…');
  await syncBalancesForDemoUsers(demoUserIds, year);

  console.log('\n✓ Eagle HR internal leave demo ready');
  console.log('  Users:', DEMO_USERS.length, `(@${EMAIL_DOMAIN})`);
  console.log('  Password:', DEMO_PASSWORD);
  console.log('  Route: /dashboard/staff-leave (or /dashboard/leave)');
  console.log('  Logins: admin@eaglehr.co.ke, wanjiku.mwangi@eaglehr.co.ke, james.otieno@eaglehr.co.ke');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
