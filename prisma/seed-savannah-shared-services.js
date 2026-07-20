/**
 * Make the HR Outsourcing demo logical as an INTERNAL GROUP SHARED-SERVICES setup.
 *
 * Model: the tenant "Savannah Freight & Logistics Ltd" is a logistics GROUP. Its central
 * HR shared-services function administers HR, payroll, attendance, and leave for the group's
 * own operating entities (Kenya + Uganda) — it is NOT outsourcing to third parties, and it
 * is not its own client. Each entity's workspace client is therefore renamed to the
 * operating subsidiary it represents.
 *
 * What this does (idempotent):
 *   - Renames the KE entity workspace client  -> "Savannah Freight Kenya Ltd"
 *   - Renames the UG entity workspace client   -> "Savannah Freight Uganda Ltd"
 *   - Seeds the Uganda subsidiary workforce (currently empty) + current-month payroll
 *
 * Run: npm run db:seed-savannah-shared-services
 */

const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

const ORG_SLUG = process.env.SEED_ORG_SLUG || 'demo-cargo-logistics';
const UG_EMAIL_TAG = '@savannah-ug.seed';

const RENAMES = [
  {
    entityCode: 'ke',
    name: 'Savannah Freight Kenya Ltd',
    contactName: 'Grace Wanjiku',
    contactEmail: 'hr.ke@savannahfreight.co.ke',
    county: 'Nairobi',
  },
  {
    entityCode: 'ug',
    name: 'Savannah Freight Uganda Ltd',
    contactName: 'Josephine Nabirye',
    contactEmail: 'hr.ug@savannahfreight.co.ke',
    county: 'Kampala',
  },
];

/** [firstName, lastName, jobTitle, departmentName, baseSalary] */
const UG_WORKFORCE = [
  ['Robert', 'Okumu', 'Long-haul Driver — Malaba corridor', 'Fleet & Drivers', 60000],
  ['Christine', 'Nakato', 'Dispatch Controller — Kampala hub', 'Dispatch', 72000],
  ['Isaac', 'Wanyama', 'Warehouse Supervisor — Nakawa depot', 'Warehouse', 78000],
  ['Betty', 'Auma', 'Customs Clearing Officer — Malaba/Busia', 'Customs & Clearing', 70000],
  ['Samuel', 'Ssentongo', 'Fleet Maintenance Coordinator', 'Fleet & Drivers', 66000],
  ['Josephine', 'Nabirye', 'HR & Payroll Officer — Uganda', 'HR & Administration', 68000],
];

function padNum(n, w) {
  return String(n).padStart(w, '0');
}

function payrollFromBasic(baseSalary) {
  const allowanceAmt = Math.round(baseSalary * 0.08 * 100) / 100;
  const gross = Math.round((baseSalary + allowanceAmt) * 100) / 100;
  const paye = Math.round(gross * 0.12 * 100) / 100;
  const nssf = 2160;
  const nhif = Math.round(gross * 0.0275 * 100) / 100;
  const ahl = Math.round(gross * 0.015 * 100) / 100;
  const net = Math.round((gross - paye - nssf - nhif - ahl) * 100) / 100;
  return {
    basicPay: new Decimal(baseSalary.toFixed(2)),
    grossPay: new Decimal(gross.toFixed(2)),
    paye: new Decimal(paye.toFixed(2)),
    nssf: new Decimal(nssf.toFixed(2)),
    nhif: new Decimal(nhif.toFixed(2)),
    ahl: new Decimal(ahl.toFixed(2)),
    netPay: new Decimal(Math.max(0, net).toFixed(2)),
    allowanceAmt,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const org = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    console.error(`Organization with slug "${ORG_SLUG}" not found.`);
    process.exit(1);
  }
  console.log(`Group tenant: ${org.name} (${org.slug})`);

  // 1) Rename per-entity workspace clients to operating subsidiaries.
  for (const r of RENAMES) {
    const client = await prisma.outsourcingClient.findFirst({
      where: { organizationId: org.id, entityCode: r.entityCode },
      select: { id: true, name: true },
    });
    if (!client) {
      console.log(`  (no ${r.entityCode.toUpperCase()} entity client found — skipping)`);
      continue;
    }
    await prisma.outsourcingClient.update({
      where: { id: client.id },
      data: {
        name: r.name,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        county: r.county,
      },
    });
    console.log(`  Renamed ${r.entityCode.toUpperCase()} entity: "${client.name}" -> "${r.name}"`);
  }

  // 2) Seed Uganda subsidiary workforce (idempotent by email tag).
  const ug = await prisma.outsourcingClient.findFirst({
    where: { organizationId: org.id, entityCode: 'ug' },
    include: { departments: true },
  });
  if (!ug) {
    console.log('No UG entity client — done.');
    return;
  }

  const removed = await prisma.employee.deleteMany({
    where: { outsourcingClientId: ug.id, email: { contains: UG_EMAIL_TAG } },
  });
  if (removed.count) console.log(`  Cleared ${removed.count} prior UG seed employee(s).`);

  const deptByName = Object.fromEntries(ug.departments.map((d) => [d.name, d.id]));
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let created = 0;
  for (let i = 0; i < UG_WORKFORCE.length; i++) {
    const [firstName, lastName, jobTitle, deptName, baseSalary] = UG_WORKFORCE[i];
    const n = i + 1;
    const emp = await prisma.employee.create({
      data: {
        organizationId: org.id,
        outsourcingClientId: ug.id,
        departmentId: deptByName[deptName] ?? null,
        employeeNumber: `SFL-UG-${padNum(n, 3)}`,
        firstName,
        lastName,
        email: `sfl.ug${padNum(n, 3)}${UG_EMAIL_TAG}`,
        phone: `+256 71${padNum((n % 9) + 1, 1)} ${padNum(100 + n, 3)} ${padNum(200 + n, 3)}`,
        jobTitle,
        idNumber: `UGID-${padNum(n, 7)}`,
        kraPin: `TIN-UG-${padNum(n, 6)}`,
        nssfNumber: `NSSF-UG-${padNum(n, 6)}`,
        bankName: n % 2 === 0 ? 'Stanbic Bank Uganda' : 'Absa Bank Uganda',
        bankBranch: 'Kampala Road',
        bankAccountNumber: `UG${padNum(n, 9)}`,
        dateOfJoining: new Date('2024-04-01'),
        baseSalary: new Decimal(baseSalary.toFixed(2)),
        employmentStatus: 'active',
      },
    });

    const p = payrollFromBasic(baseSalary);
    await prisma.payroll.create({
      data: {
        organizationId: org.id,
        employeeId: emp.id,
        month,
        year,
        basicPay: p.basicPay,
        allowances: [{ name: 'Field / route allowance', amount: p.allowanceAmt }],
        deductions: [],
        grossPay: p.grossPay,
        paye: p.paye,
        nssf: p.nssf,
        nhif: p.nhif,
        ahl: p.ahl,
        netPay: p.netPay,
        status: 'approved',
      },
    });
    created++;
  }
  console.log(`  Seeded ${created} Uganda subsidiary employee(s) + payroll for ${month}/${year}.`);

  const summary = await prisma.outsourcingClient.findMany({
    where: { organizationId: org.id },
    select: { name: true, entityCode: true, _count: { select: { employees: true, departments: true } } },
    orderBy: { entityCode: 'asc' },
  });
  console.log('\nGroup shared-services entities:');
  for (const row of summary) {
    console.log(
      `  • ${row.name} [${row.entityCode ?? '—'}] — ${row._count.employees} employees, ${row._count.departments} departments`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
