/**
 * Sample client: bi-weekly payroll (two period grosses per month; monthly statutory on combined).
 *
 * Run: node prisma/seed-biweekly-client.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAME = 'Two-Week Pay Demo Ltd';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const existing = await prisma.outsourcingClient.findFirst({ where: { name: NAME } });
  if (existing) {
    await prisma.outsourcingClient.delete({ where: { id: existing.id } });
    console.log('Removed previous', NAME);
  }

  const client = await prisma.outsourcingClient.create({
    data: {
      name: NAME,
      contactName: 'Payroll Contact',
      contactEmail: 'payroll@twoweekdemo.test',
      employeeNumberPrefix: 'TWP',
      payrollFrequency: 'biweekly',
      // Client X: NSSF/SHIF/AHL on basic+allowances only; leave pay separate (PAYE on combined).
      leavePayMode: 'paye_only',
      departments: { create: [{ name: 'Operations' }] },
    },
    include: { departments: true },
  });

  await prisma.employee.create({
    data: {
      outsourcingClientId: client.id,
      departmentId: client.departments[0].id,
      employeeNumber: 'TWP-001',
      firstName: 'Sample',
      lastName: 'Biweekly',
      email: 'sample.biweekly@twoweekdemo.test',
      baseSalary: new (require('@prisma/client/runtime/library').Decimal)(80000),
      jobTitle: 'Operator',
    },
  });

  console.log('\nCreated:', NAME);
  console.log('  id:', client.id);
  console.log('  payrollFrequency: biweekly');
  console.log('\n1. Client edit API: PATCH ... { payrollFrequency: "biweekly" } for any client');
  console.log('2. Payroll → select this client → Generate → Edit row → Period 1 / Period 2 gross');
  console.log('3. leavePayMode paye_only → NSSF/SHIF/AHL on (P1+P2+allowances) only; set Leave pay on row + Save to recalc');
  console.log('4. Or generate with defaultLeavePay for draft leave amounts\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
