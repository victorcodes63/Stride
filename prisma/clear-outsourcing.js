/**
 * Deletes ALL outsourcing clients and related data (departments, employees,
 * payroll, leave balances/applications, attendance) via DB cascades.
 *
 * Run: node prisma/clear-outsourcing.js
 * Or:  npm run db:clear-outsourcing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.outsourcingClient.count();
  if (before === 0) {
    console.log('No outsourcing clients to delete.');
    return;
  }
  const empCount = await prisma.employee.count();
  const result = await prisma.outsourcingClient.deleteMany({});
  console.log(`Deleted ${result.count} outsourcing client(s).`);
  console.log(`(Cascaded: had ${empCount} employee record(s) and related payroll/leave/attendance.)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
