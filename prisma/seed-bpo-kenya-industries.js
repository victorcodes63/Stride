/**
 * Replace HR Outsourcing demo end-clients with Kenyan floriculture + soda-ash industries.
 * Clears existing outsourcing clients for the target org, then reseeds.
 *
 * Default org: SwiftFreight East Africa Ltd (demo-cargo-logistics) — matches the BPO overview
 * the product team has been demoing. Override with SEED_ORGANIZATION_ID.
 *
 * Run:
 *   node -e "..."  (see package.json db:seed-bpo-kenya)
 *   npm run db:seed-bpo-kenya
 */

const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

const EMAIL_TAG = '@bloomvale-bpo.seed';
const DEFAULT_ORG_SLUG = 'demo-cargo-logistics';

const BLOOMVALE = {
  name: 'Bloomvale Floriculture Ltd',
  prefix: 'BVF',
  contactName: 'Wanjiku Kariuki',
  contactEmail: 'wanjiku.kariuki@bloomvale.co.ke',
  contactPhone: '+254 722 410 880',
  kraPin: 'P051778899A',
  nssfEmployerNumber: 'NSSF-EMP-BVF-2024',
  nhifEmployerNumber: 'SHIF-BVF-44102',
  companyRegistrationNumber: 'PVT-NAIV-FLORA-2019',
  vatNumber: 'P000441102X',
  bankName: 'Equity Bank',
  bankAccountNumber: '0140198765432',
  bankBranch: 'Naivasha',
  bankSwiftCode: 'EQBLKENA',
  postalAddress: 'P.O. Box 1288-20117, Naivasha',
  county: 'Nakuru',
  contractNotes:
    'EU cut-flower export farm (roses & spray carnations). Outsourced greenhouse, packhouse, cold-chain and compliance workforce under Kenyan Employment Act.',
  departments: [
    'Greenhouse Production',
    'Packhouse & Grading',
    'Cold Chain & Logistics',
    'Quality & Phytosanitary',
    'Farm Admin & HR Liaison',
  ],
  workforce: [
    ['Grace', 'Nyambura', 'Farm Operations Manager', 'Farm Admin & HR Liaison', 165000],
    ['Peter', 'Kamau', 'Greenhouse Supervisor — Block A', 'Greenhouse Production', 78000],
    ['Faith', 'Chebet', 'Greenhouse Supervisor — Block B', 'Greenhouse Production', 76000],
    ['Joseph', 'Otieno', 'Irrigation & Fertigation Lead', 'Greenhouse Production', 72000],
    ['Mary', 'Wanjiru', 'Rose Harvester Lead', 'Greenhouse Production', 42000],
    ['Brian', 'Kiprono', 'Rose Harvester', 'Greenhouse Production', 38000],
    ['Alice', 'Akinyi', 'Rose Harvester', 'Greenhouse Production', 38000],
    ['Daniel', 'Mwangi', 'Packhouse Supervisor', 'Packhouse & Grading', 82000],
    ['Ruth', 'Muthoni', 'Grading Specialist', 'Packhouse & Grading', 48000],
    ['Samuel', 'Odhiambo', 'Bunching & Sleeve Operator', 'Packhouse & Grading', 41000],
    ['Nancy', 'Kerubo', 'Quality Inspector — Stems', 'Quality & Phytosanitary', 55000],
    ['Eric', 'Maina', 'Phytosanitary Compliance Officer', 'Quality & Phytosanitary', 98000],
    ['Lucy', 'Atieno', 'Cold Room Supervisor', 'Cold Chain & Logistics', 68000],
    ['Kevin', 'Njoroge', 'Reefer Truck Coordinator', 'Cold Chain & Logistics', 62000],
    ['Beatrice', 'Wambui', 'Export Documentation Clerk', 'Cold Chain & Logistics', 52000],
    ['Francis', 'Owino', 'HSE & Chemical Store Officer', 'Farm Admin & HR Liaison', 88000],
    ['Ann', 'Muthee', 'Time & Attendance Clerk', 'Farm Admin & HR Liaison', 45000],
    ['George', 'Kiptoo', 'Night Security — Packhouse', 'Cold Chain & Logistics', 36000],
  ],
};

const MAGADI = {
  name: 'Lake Magadi Salt & Soda Works',
  prefix: 'LMS',
  contactName: 'David ole Sankale',
  contactEmail: 'david.sankale@magadisalt.co.ke',
  contactPhone: '+254 720 335 091',
  kraPin: 'P051334455B',
  nssfEmployerNumber: 'NSSF-EMP-LMS-2023',
  nhifEmployerNumber: 'SHIF-LMS-22011',
  companyRegistrationNumber: 'PVT-KAJI-SALT-2016',
  vatNumber: 'P000220118Y',
  bankName: 'KCB Bank',
  bankAccountNumber: '1176543210987',
  bankBranch: 'Industrial Area',
  bankSwiftCode: 'KCBLKENX',
  postalAddress: 'P.O. Box 1-00205, Magadi',
  county: 'Kajiado',
  contractNotes:
    'Soda ash and crystalline salt extraction on Lake Magadi. Outsourced plant operators, crystalliser crews, and logistics under a multi-year BPO labour contract.',
  departments: ['Crystal Harvest', 'Soda Ash Plant', 'Rail & Road Logistics', 'Plant Safety'],
  workforce: [
    ['James', 'Parsai', 'Plant Manager', 'Soda Ash Plant', 175000],
    ['Mercy', 'Naserian', 'Crystalliser Supervisor', 'Crystal Harvest', 85000],
    ['Stephen', 'Lekishon', 'Salt Harvester Lead', 'Crystal Harvest', 48000],
    ['Jane', 'Nasieku', 'Salt Harvester', 'Crystal Harvest', 39000],
    ['Michael', 'Ole Kulet', 'Calciner Operator', 'Soda Ash Plant', 72000],
    ['Caroline', 'Sitonik', 'Lab & Assay Technician', 'Soda Ash Plant', 64000],
    ['Philip', 'Kipchumba', 'Rail Siding Coordinator', 'Rail & Road Logistics', 70000],
    ['Rose', 'Chepkoech', 'HSE Officer — Magadi Site', 'Plant Safety', 95000],
  ],
};

function padNum(n, w) {
  return String(n).padStart(w, '0');
}

function payrollFromBasic(baseSalary) {
  const allowanceAmt = Math.round(baseSalary * 0.1 * 100) / 100;
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

async function resolveOrganizationId() {
  if (process.env.SEED_ORGANIZATION_ID) return process.env.SEED_ORGANIZATION_ID;
  const bySlug = await prisma.organization.findFirst({
    where: { slug: DEFAULT_ORG_SLUG },
    select: { id: true, name: true },
  });
  if (bySlug) return bySlug.id;
  const withClients = await prisma.outsourcingClient.findFirst({
    where: { name: { contains: 'SwiftFreight' } },
    select: { organizationId: true },
  });
  if (withClients) return withClients.organizationId;
  const any = await prisma.organization.findFirst({
    where: { slug: { startsWith: 'demo-' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return any?.id ?? null;
}

async function clearOutsourcingForOrg(organizationId) {
  const clients = await prisma.outsourcingClient.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  if (clients.length === 0) {
    console.log('No existing outsourcing clients to clear.');
    return;
  }

  const clientIds = clients.map((c) => c.id);

  // Unlink jobs / accounts profiles that SetNull on client delete
  await prisma.job.updateMany({
    where: { outsourcingClientId: { in: clientIds } },
    data: { outsourcingClientId: null },
  }).catch(() => {});

  const deleted = await prisma.outsourcingClient.deleteMany({
    where: { organizationId },
  });
  console.log(
    `Cleared ${deleted.count} outsourcing client(s): ${clients.map((c) => c.name).join(', ')}`,
  );
}

async function seedEndClient(organizationId, spec, emailPrefix, entityCode = null) {
  const client = await prisma.outsourcingClient.create({
    data: {
      organizationId,
      name: spec.name,
      status: 'active',
      contactName: spec.contactName,
      contactEmail: spec.contactEmail,
      contactPhone: spec.contactPhone,
      employeeNumberPrefix: spec.prefix,
      kraPin: spec.kraPin,
      nssfEmployerNumber: spec.nssfEmployerNumber,
      nhifEmployerNumber: spec.nhifEmployerNumber,
      companyRegistrationNumber: spec.companyRegistrationNumber,
      vatNumber: spec.vatNumber,
      bankName: spec.bankName,
      bankAccountNumber: spec.bankAccountNumber,
      bankBranch: spec.bankBranch,
      bankSwiftCode: spec.bankSwiftCode,
      currency: 'KES',
      billingCycle: 'monthly',
      serviceFeeType: 'per_employee',
      serviceFeeAmount: new Decimal('2800'),
      paymentTerms: 'Net 30',
      postalAddress: spec.postalAddress,
      county: spec.county,
      contractStartDate: new Date('2025-01-01'),
      contractEndDate: new Date('2027-12-31'),
      contractNotes: spec.contractNotes,
      whiteLabelReports: true,
      reportAccentColor: '#0F6B4C',
      entityCode,
      departments: {
        create: spec.departments.map((name) => ({
          organizationId,
          name,
        })),
      },
      rateCards: {
        create: [
          {
            organizationId,
            name: 'Standard BPO rate card',
            effectiveFrom: new Date('2025-01-01'),
            currency: 'KES',
            isActive: true,
            lines: {
              create: [
                {
                  organizationId,
                  serviceKey: 'per_head',
                  label: 'Per employee / month',
                  pricingModel: 'per_head',
                  unitAmount: new Decimal('2800'),
                  sortOrder: 0,
                },
              ],
            },
          },
        ],
      },
    },
    include: { departments: true },
  });

  const deptMap = Object.fromEntries(client.departments.map((d) => [d.name, d.id]));
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T12:00:00.000Z`);

  const created = [];
  for (let i = 0; i < spec.workforce.length; i++) {
    const [firstName, lastName, jobTitle, deptName, baseSalary] = spec.workforce[i];
    const n = i + 1;
    const emp = await prisma.employee.create({
      data: {
        organizationId,
        outsourcingClientId: client.id,
        departmentId: deptMap[deptName] ?? null,
        employeeNumber: `${spec.prefix}-${padNum(n, 3)}`,
        firstName,
        lastName,
        email: `${emailPrefix}${padNum(n, 3)}${EMAIL_TAG}`,
        phone: `+254 71${padNum((n % 9) + 1, 1)} ${padNum(100 + n, 3)} ${padNum(200 + n, 3)}`,
        jobTitle,
        idNumber: `${spec.prefix === 'BVF' ? '32' : '33'}${padNum(n, 6)}`,
        kraPin: `A0${padNum(n, 7)}${String.fromCharCode(65 + (n % 26))}`,
        nssfNumber: `NSSF-${spec.prefix}-${padNum(n, 5)}`,
        nhifNumber: `SHIF-${spec.prefix}-${padNum(n, 5)}`,
        bankName: n % 2 === 0 ? 'Equity Bank' : 'KCB Bank',
        bankBranch: spec.bankBranch,
        bankAccountNumber: `${spec.prefix}${padNum(n, 8)}`,
        dateOfJoining: new Date('2024-02-01'),
        baseSalary: new Decimal(baseSalary.toFixed(2)),
        employmentStatus: 'active',
      },
    });
    created.push({ emp, baseSalary });
  }

  for (const { emp, baseSalary } of created) {
    const p = payrollFromBasic(baseSalary);
    await prisma.payroll.create({
      data: {
        organizationId,
        employeeId: emp.id,
        month,
        year,
        basicPay: p.basicPay,
        allowances: [{ name: 'Site / shift allowance', amount: p.allowanceAmt }],
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
  }

  // A few open attendance exceptions for overview realism
  for (let i = 0; i < Math.min(2, created.length); i++) {
    const { emp } = created[i];
    await prisma.attendanceDaySummary.create({
      data: {
        organizationId,
        employeeId: emp.id,
        outsourcingClientId: client.id,
        workDate: todayDate,
        firstInAt: new Date(`${todayStr}T05:50:00.000Z`),
        lastOutAt: null,
        minutesWorked: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        holidayOvertimeMinutes: 0,
        status: 'draft',
      },
    }).catch(() => {});
    await prisma.attendanceException.create({
      data: {
        organizationId,
        employeeId: emp.id,
        workDate: todayDate,
        type: 'missing_check_out',
        status: 'open',
        description: 'Missing clock-out — packhouse / plant shift',
      },
    }).catch(() => {});
  }

  console.log(`Seeded ${client.name}: ${created.length} employees, ${client.departments.length} departments.`);
  return client;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    console.error('No organization found. Set SEED_ORGANIZATION_ID.');
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true },
  });
  console.log(`Target org: ${org?.name} (${org?.slug})`);

  await clearOutsourcingForOrg(organizationId);
  await seedEndClient(organizationId, BLOOMVALE, 'bvf', 'ke');
  await seedEndClient(organizationId, MAGADI, 'lms', null);

  const totals = await prisma.outsourcingClient.findMany({
    where: { organizationId },
    select: { name: true, _count: { select: { employees: true } } },
  });
  console.log('\nHR Outsourcing demo ready:');
  for (const row of totals) {
    console.log(`  • ${row.name} — ${row._count.employees} employees`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
