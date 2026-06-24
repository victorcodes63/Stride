/**
 * Seed employees for outsourcing clients (development/testing).
 * Run: node prisma/seed-outsourcing-employees.js
 * Requires outsourcing clients to exist (run seed-outsourcing-clients.js first).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMPLOYEE_SEEDS = [
  {
    employeeNumber: '001',
    firstName: 'Musa Said',
    lastName: 'Oduwo',
    email: 'musa.oduwo@example.com',
    phone: '+254 700 211 001',
    jobTitle: 'Cleaner',
    kraPin: 'A001234567K',
    nssfNumber: '12345678901',
    nhifNumber: '98765432101',
    bankName: 'Equity',
    bankBranch: 'Kisauni Branch',
    bankAccountNumber: '01234567890',
  },
  {
    employeeNumber: '002',
    firstName: 'Mohamed Abdi',
    lastName: 'Salah',
    email: 'mohamed.salah@example.com',
    phone: '+254 700 211 002',
    jobTitle: 'Assistant',
    kraPin: 'A002345678L',
    nssfNumber: '12345678902',
    nhifNumber: '98765432102',
    bankName: 'KCB',
    bankBranch: 'B.S.A',
    bankAccountNumber: '11223344556',
  },
  {
    employeeNumber: '003',
    firstName: 'Amin Mohamud',
    lastName: 'Adan',
    email: 'amin.adan@example.com',
    phone: '+254 700 211 003',
    jobTitle: 'Marketing',
    kraPin: 'A003456789M',
    nssfNumber: '12345678903',
    nhifNumber: '98765432103',
    bankName: 'KCB',
    bankBranch: 'Mfiliani',
    bankAccountNumber: '22334455667',
  },
  {
    employeeNumber: '004',
    firstName: 'Dekow Mihyae',
    lastName: 'Isaack',
    email: 'dekow.isaack@example.com',
    phone: '+254 700 211 004',
    jobTitle: 'Accountant',
    kraPin: 'A004567890N',
    nssfNumber: '12345678904',
    nhifNumber: '98765432104',
    bankName: 'Equity',
    bankBranch: 'Cross Roads',
    bankAccountNumber: '33445566778',
  },
  {
    employeeNumber: '005',
    firstName: 'Fropa Salma',
    lastName: 'Mohamed',
    email: 'fropa.mohamed@example.com',
    phone: '+254 700 211 005',
    jobTitle: 'Assistant',
    kraPin: 'A005678901O',
    nssfNumber: '12345678905',
    nhifNumber: '98765432105',
    bankName: 'KCB',
    bankBranch: 'Gorgoria',
    bankAccountNumber: '44556677889',
  },
  {
    employeeNumber: '006',
    firstName: 'Said Mohamed',
    lastName: 'Abdiha',
    email: 'said.abdiha@example.com',
    phone: '+254 700 211 006',
    jobTitle: 'Accountant',
    kraPin: 'A006789012P',
    nssfNumber: '12345678906',
    nhifNumber: '98765432106',
    bankName: 'Equity',
    bankBranch: 'Sayle Branch',
    bankAccountNumber: '55667788990',
  },
];

async function main() {
  const clients = await prisma.outsourcingClient.findMany({
    orderBy: { name: 'asc' },
    take: 3,
    include: { departments: { take: 2 } },
  });

  if (clients.length === 0) {
    console.log('No outsourcing clients found. Run seed-outsourcing-clients.js first.');
    process.exit(1);
  }

  let created = 0;
  for (let i = 0; i < EMPLOYEE_SEEDS.length; i++) {
    const seed = EMPLOYEE_SEEDS[i];
    const client = clients[i % clients.length];
    const dept = client.departments[i % Math.max(1, client.departments.length)];

    const existing = await prisma.employee.findFirst({
      where: {
        email: seed.email,
        outsourcingClientId: client.id,
      },
    });

    if (existing) {
      console.log(`Employee ${seed.firstName} ${seed.lastName} already exists for ${client.name}, skipping.`);
      continue;
    }

    await prisma.employee.create({
      data: {
        outsourcingClientId: client.id,
        departmentId: dept?.id ?? null,
        employeeNumber: seed.employeeNumber,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        phone: seed.phone,
        jobTitle: seed.jobTitle,
        kraPin: seed.kraPin,
        nssfNumber: seed.nssfNumber,
        nhifNumber: seed.nhifNumber,
        bankName: seed.bankName,
        bankBranch: seed.bankBranch,
        bankAccountNumber: seed.bankAccountNumber,
        dateOfJoining: new Date('2024-06-01'),
      },
    });
    created++;
    console.log(`Created employee ${seed.employeeNumber} ${seed.firstName} ${seed.lastName} (${seed.jobTitle}) for ${client.name}`);
  }

  console.log(`\nDone. Created ${created} employee(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
