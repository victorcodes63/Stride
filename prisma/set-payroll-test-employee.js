/**
 * Sets one SABIC-seed employee (SRK-001) to Victor Test + your email for payroll testing.
 *
 * Run: node prisma/set-payroll-test-employee.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLIENT_NAME = 'Summit Retail Kenya Ltd';
const EMPLOYEE_NUMBER = 'SRK-001'; // first CSV row; change if needed
const FIRST_NAME = 'Victor';
const LAST_NAME = 'Test';
const EMAIL = 'vichumo38@gmail.com';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = await prisma.outsourcingClient.findFirst({
    where: { name: CLIENT_NAME },
  });
  if (!client) {
    console.error(`Client "${CLIENT_NAME}" not found. Run db:seed-one-outsourcing + db:seed-sabic-payroll first.`);
    process.exit(1);
  }

  const emp = await prisma.employee.findFirst({
    where: {
      outsourcingClientId: client.id,
      employeeNumber: EMPLOYEE_NUMBER,
    },
  });

  if (!emp) {
    console.error(`No employee ${EMPLOYEE_NUMBER} on ${CLIENT_NAME}. Run db:seed-sabic-payroll.`);
    process.exit(1);
  }

  const dup = await prisma.employee.findFirst({
    where: {
      outsourcingClientId: client.id,
      email: EMAIL.toLowerCase(),
      id: { not: emp.id },
    },
  });
  if (dup) {
    console.error(`Email ${EMAIL} already used by another employee in this client.`);
    process.exit(1);
  }

  const updated = await prisma.employee.update({
    where: { id: emp.id },
    data: {
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      email: EMAIL.toLowerCase(),
    },
  });

  console.log('Updated for payroll testing:');
  console.log({
    id: updated.id,
    employeeNumber: updated.employeeNumber,
    name: `${updated.firstName} ${updated.lastName}`,
    email: updated.email,
    baseSalary: updated.baseSalary != null ? String(updated.baseSalary) : null,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
