/**
 * Default leave types + balances for all active users (current year).
 * Run: node prisma/seed-staff-leave.js
 * Requires: DATABASE_URL, existing User rows
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_TYPES = [
  { name: 'Annual leave', daysPerYear: 21, color: '#043d4a', sortOrder: 0, description: 'Standard annual entitlement (Kenya).' },
  { name: 'Sick leave', daysPerYear: 7, color: '#b45309', sortOrder: 1, description: 'Paid sick days.' },
  { name: 'Maternity', daysPerYear: 90, color: '#7c3aed', sortOrder: 2, requiresApproval: true },
  { name: 'Paternity', daysPerYear: 14, color: '#6366f1', sortOrder: 3 },
  { name: 'Compassionate', daysPerYear: 5, color: '#64748b', sortOrder: 4 },
  { name: 'Unpaid leave', daysPerYear: 0, color: '#94a3b8', sortOrder: 99, description: 'Does not consume paid balance; still needs approval.' },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }
  const year = new Date().getFullYear();
  let types = await prisma.staffLeaveType.findMany();
  if (types.length === 0) {
    for (const t of DEFAULT_TYPES) {
      await prisma.staffLeaveType.create({ data: t });
    }
    types = await prisma.staffLeaveType.findMany();
    console.log('Created', types.length, 'leave types');
  } else {
    console.log('Leave types already exist:', types.length);
  }

  const users = await prisma.user.findMany({ where: { isActive: true } });
  let created = 0;
  for (const u of users) {
    for (const t of types) {
      if (!t.active) continue;
      const ex = await prisma.staffLeaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: u.id, leaveTypeId: t.id, year } },
      });
      if (!ex) {
        await prisma.staffLeaveBalance.create({
          data: {
            userId: u.id,
            leaveTypeId: t.id,
            year,
            entitledDays: t.daysPerYear,
            usedDays: 0,
            carriedOver: 0,
          },
        });
        created++;
      }
    }
  }
  console.log('Balances created:', created, 'for', users.length, 'users, year', year);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
