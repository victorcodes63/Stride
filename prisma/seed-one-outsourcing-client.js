/**
 * Seed exactly one outsourcing client with every field populated (+ sample departments).
 * Re-run safe: removes previous seed client by name first.
 *
 * Run: node prisma/seed-one-outsourcing-client.js
 * Or:  npm run db:seed-one-outsourcing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_NAME = 'Summit Retail Kenya Ltd';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const existing = await prisma.outsourcingClient.findFirst({
    where: { name: SEED_NAME },
    include: { departments: true },
  });
  if (existing) {
    await prisma.outsourcingClient.delete({ where: { id: existing.id } });
    console.log(`Removed existing "${SEED_NAME}" (cascades employees/depts).`);
  }

  const client = await prisma.outsourcingClient.create({
    data: {
      name: SEED_NAME,
      contactName: 'Grace Wanjiru Muthoni',
      contactEmail: 'grace.muthoni@summitretail.co.ke',
      contactPhone: '+254 722 555 014',
      employeeNumberPrefix: 'SRK',

      kraPin: 'P051987654A',
      nssfEmployerNumber: 'NSSF-EMP-SRK-2025',
      nhifEmployerNumber: 'NHIF-991772',
      companyRegistrationNumber: 'PVT-LRQ9U2KE2024',
      vatNumber: 'P000888777X',

      bankName: 'Co-operative Bank of Kenya',
      bankAccountNumber: '0112345678900',
      bankBranch: 'Sarit Centre',
      bankSwiftCode: 'KCOOKENA',
      currency: 'KES',
      billingCycle: 'monthly',
      serviceFeeType: 'per_employee',
      serviceFeeAmount: 3200,
      paymentTerms: 'Net 30',

      postalAddress: 'P.O. Box 44116-00100, Nairobi',
      county: 'Nairobi',

      contractStartDate: new Date('2025-01-01'),
      contractEndDate: new Date('2027-12-31'),

      departments: {
        create: [
          { name: 'Operations' },
          { name: 'Finance & Admin' },
          { name: 'Stores' },
        ],
      },
    },
    include: { departments: true },
  });

  console.log('\nSeeded outsourcing client (all fields + departments):\n');
  console.log(JSON.stringify(
    {
      id: client.id,
      name: client.name,
      employeeNumberPrefix: client.employeeNumberPrefix,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      kraPin: client.kraPin,
      nssfEmployerNumber: client.nssfEmployerNumber,
      nhifEmployerNumber: client.nhifEmployerNumber,
      companyRegistrationNumber: client.companyRegistrationNumber,
      vatNumber: client.vatNumber,
      bankName: client.bankName,
      bankAccountNumber: client.bankAccountNumber,
      bankBranch: client.bankBranch,
      bankSwiftCode: client.bankSwiftCode,
      currency: client.currency,
      billingCycle: client.billingCycle,
      serviceFeeType: client.serviceFeeType,
      serviceFeeAmount: String(client.serviceFeeAmount),
      paymentTerms: client.paymentTerms,
      postalAddress: client.postalAddress,
      county: client.county,
      contractStartDate: client.contractStartDate?.toISOString().slice(0, 10),
      contractEndDate: client.contractEndDate?.toISOString().slice(0, 10),
      departments: client.departments.map((d) => d.name),
    },
    null,
    2
  ));
  console.log(`\nOpen in app: /dashboard/outsourcing/clients/${client.id}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
