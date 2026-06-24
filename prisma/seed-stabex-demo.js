/**
 * Seed primary outsourcing client + workforce for Stabex-style LPG & fuel retail demo.
 * Safe to re-run: removes prior demo rows (@stabex-demo.seed) then recreates.
 *
 * Run: node prisma/seed-stabex-demo.js
 * Requires DATABASE_URL (e.g. load .env.local first).
 */

const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

const EMAIL_TAG = '@stabex-demo.seed';

const DEPARTMENTS = [
  'Head Office & Finance',
  'LPG Operations',
  'Retail & Fuel Stations',
  'Logistics & Fleet',
  'HSE & Compliance',
];

/** ~28 roles across stations, LPG, logistics */
const WORKFORCE = [
  ['James', 'Mwangi', 'Regional Retail Manager', 'Head Office & Finance', 185000],
  ['Grace', 'Njeri', 'LPG Plant Supervisor', 'LPG Operations', 142000],
  ['Brian', 'Kipchoge', 'Fleet Operations Lead', 'Logistics & Fleet', 138000],
  ['Mary', 'Akinyi', 'Station Manager — Embakasi', 'Retail & Fuel Stations', 98000],
  ['David', 'Kamau', 'Station Manager — Mombasa Road', 'Retail & Fuel Stations', 96000],
  ['Faith', 'Wambui', 'Fuel & LPG Pricing Analyst', 'Head Office & Finance', 112000],
  ['Joseph', 'Otieno', 'LPG Bulk Dispatch Coordinator', 'LPG Operations', 88000],
  ['Nancy', 'Chebet', 'Cylinder Exchange Supervisor', 'LPG Operations', 82000],
  ['Peter', 'Njoroge', 'Fuel Station Supervisor — Westlands', 'Retail & Fuel Stations', 78000],
  ['Lucy', 'Muthoni', 'Fuel Station Supervisor — Thika', 'Retail & Fuel Stations', 76000],
  ['Eric', 'Omondi', 'LPG Delivery Driver', 'Logistics & Fleet', 52000],
  ['Rose', 'Kerubo', 'Fuel Tanker Driver', 'Logistics & Fleet', 54000],
  ['Stephen', 'Mutua', 'Fleet Maintenance Technician', 'Logistics & Fleet', 68000],
  ['Alice', 'Nyambura', 'Retail Operations Coordinator', 'Retail & Fuel Stations', 92000],
  ['Kevin', 'Maina', 'Fuel Attendant — Kasarani', 'Retail & Fuel Stations', 38000],
  ['Sarah', 'Adhiambo', 'Fuel Attendant — Ruiru', 'Retail & Fuel Stations', 38500],
  ['Daniel', 'Karanja', 'LPG Refilling Technician', 'LPG Operations', 51000],
  ['Beatrice', 'Wanjiru', 'Cylinder QA Inspector', 'LPG Operations', 62000],
  ['Francis', 'Owino', 'HSE Officer — Retail Network', 'HSE & Compliance', 118000],
  ['Ruth', 'Moraa', 'Environmental Compliance Specialist', 'HSE & Compliance', 104000],
  ['Philip', 'Odhiambo', 'Fire & Safety Trainer', 'HSE & Compliance', 87000],
  ['Caroline', 'Atieno', 'Cashier — Flagship Station', 'Retail & Fuel Stations', 42000],
  ['Michael', 'Kimani', 'Night Shift Supervisor', 'Retail & Fuel Stations', 72000],
  ['Jane', 'Nyambura', 'Inventory Controller — Depots', 'Logistics & Fleet', 81000],
  ['Samuel', 'Kiptoo', 'Station Auditor', 'Head Office & Finance', 99000],
  ['Ann', 'Muthee', 'Customer Experience Lead', 'Retail & Fuel Stations', 89000],
  ['George', 'Otieno', 'Pipeline & Dispatch Planner', 'LPG Operations', 95000],
  ['Mercy', 'Wanjala', 'Procurement — lubricants & additives', 'Head Office & Finance', 108000],
];

function padNum(n, w) {
  return String(n).padStart(w, '0');
}

async function getOrCreateAnnualLeaveType() {
  let t = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
  if (!t) {
    t = await prisma.leaveType.create({
      data: { name: 'Annual Leave', daysPerYear: 21 },
    });
  }
  return t;
}

function payrollFromBasicAndAllowance(baseSalary) {
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
  const client = await prisma.outsourcingClient.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!client) {
    console.error('No outsourcing client found. Run prisma/seed-outsourcing-clients.js first.');
    process.exit(1);
  }

  await prisma.outsourcingClient.update({
    where: { id: client.id },
    data: {
      name: 'Stabex International',
      county: 'Nairobi',
      postalAddress: 'P.O. Box 45098 —00100, Nairobi',
      employeeNumberPrefix: 'STX',
    },
  });

  const removed = await prisma.employee.deleteMany({
    where: {
      outsourcingClientId: client.id,
      email: { contains: EMAIL_TAG },
    },
  });
  console.log(`Removed ${removed.count} prior Stabex demo employee(s).`);

  const deptMap = {};
  for (const name of DEPARTMENTS) {
    let d = await prisma.department.findFirst({
      where: { outsourcingClientId: client.id, name },
    });
    if (!d) {
      d = await prisma.department.create({
        data: { outsourcingClientId: client.id, name },
      });
    }
    deptMap[name] = d.id;
  }

  /** Remove legacy departments from older demos; move staff into Retail & Fuel Stations then delete. */
  const stabexNameSet = new Set(DEPARTMENTS);
  const fallbackDeptId = deptMap['Retail & Fuel Stations'];
  const legacyDepts = await prisma.department.findMany({
    where: {
      outsourcingClientId: client.id,
      name: { notIn: [...stabexNameSet] },
    },
  });
  for (const ld of legacyDepts) {
    await prisma.employee.updateMany({
      where: { departmentId: ld.id },
      data: { departmentId: fallbackDeptId },
    });
    await prisma.department.delete({ where: { id: ld.id } });
  }
  if (legacyDepts.length) {
    console.log(
      `Removed ${legacyDepts.length} legacy department(s); reassigned employees to "Retail & Fuel Stations".`,
    );
  }

  const annualLeave = await getOrCreateAnnualLeaveType();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T12:00:00.000Z`);

  const employeesPayload = [];
  for (let i = 0; i < WORKFORCE.length; i++) {
    const [firstName, lastName, jobTitle, deptName, baseSalary] = WORKFORCE[i];
    const n = i + 1;
    const email = `stabex${padNum(n, 3)}${EMAIL_TAG}`;
    const emp = await prisma.employee.create({
      data: {
        outsourcingClientId: client.id,
        departmentId: deptMap[deptName],
        employeeNumber: `STX-${padNum(n, 3)}`,
        firstName,
        lastName,
        email,
        phone: `+254 710 ${padNum(100 + n, 3)} ${padNum(200 + n, 3)}`,
        jobTitle,
        idNumber: `310${padNum(n, 5)}`,
        kraPin: `P05123457${padNum(n % 10, 1)}`,
        nssfNumber: `NSSF-STX-${padNum(n, 5)}`,
        nhifNumber: `SHIF-STX-${padNum(n, 5)}`,
        bankName: 'Equity Bank',
        bankBranch: 'Upper Hill',
        bankAccountNumber: `STX${padNum(n, 8)}`,
        dateOfJoining: new Date('2023-03-01'),
        baseSalary: new Decimal(baseSalary.toFixed(2)),
        employmentStatus: 'active',
      },
    });
    employeesPayload.push({ emp, baseSalary });
  }

  for (const { emp, baseSalary } of employeesPayload) {
    const p = payrollFromBasicAndAllowance(baseSalary);
    await prisma.payroll.upsert({
      where: {
        employeeId_month_year: {
          employeeId: emp.id,
          month,
          year,
        },
      },
      create: {
        employeeId: emp.id,
        month,
        year,
        basicPay: p.basicPay,
        allowances: [{ name: 'Field / shift allowance', amount: p.allowanceAmt }],
        deductions: [],
        grossPay: p.grossPay,
        paye: p.paye,
        nssf: p.nssf,
        nhif: p.nhif,
        ahl: p.ahl,
        netPay: p.netPay,
        status: 'approved',
      },
      update: {
        basicPay: p.basicPay,
        allowances: [{ name: 'Field / shift allowance', amount: p.allowanceAmt }],
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

  const countSummaries = Math.min(employeesPayload.length, 26);
  for (let i = 0; i < countSummaries; i++) {
    const { emp } = employeesPayload[i];
    const late = i % 6 === 0 ? 18 : 0;
    await prisma.attendanceDaySummary.upsert({
      where: {
        employeeId_workDate: {
          employeeId: emp.id,
          workDate: todayDate,
        },
      },
      create: {
        employeeId: emp.id,
        outsourcingClientId: client.id,
        workDate: todayDate,
        firstInAt: new Date(`${todayStr}T05:${padNum(45 + (i % 5), 2)}:00.000Z`),
        lastOutAt: new Date(`${todayStr}T14:${padNum(10 + (i % 4), 2)}:00.000Z`),
        minutesWorked: 480 - late,
        lateMinutes: late,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        holidayOvertimeMinutes: 0,
        status: 'reconciled',
      },
      update: {
        firstInAt: new Date(`${todayStr}T05:${padNum(45 + (i % 5), 2)}:00.000Z`),
        lastOutAt: new Date(`${todayStr}T14:${padNum(10 + (i % 4), 2)}:00.000Z`),
        minutesWorked: 480 - late,
        lateMinutes: late,
        status: 'reconciled',
      },
    });
  }

  const e0 = employeesPayload[0].emp;
  const e1 = employeesPayload[1].emp;
  const e2 = employeesPayload[2].emp;
  const e3 = employeesPayload[3].emp;

  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 2);
  const weekEnd = new Date(todayDate);
  weekEnd.setDate(weekEnd.getDate() + 5);

  await prisma.leaveApplication.deleteMany({
    where: {
      employeeId: { in: [e0.id, e1.id, e2.id, e3.id] },
    },
  });

  await prisma.leaveApplication.create({
    data: {
      employeeId: e0.id,
      leaveTypeId: annualLeave.id,
      startDate: new Date(`${todayStr}T00:00:00.000Z`),
      endDate: weekEnd,
      days: 5,
      status: 'approved',
      reason: 'Annual leave — customer visits upcountry',
    },
  });

  await prisma.leaveApplication.createMany({
    data: [
      {
        employeeId: e1.id,
        leaveTypeId: annualLeave.id,
        startDate: tomorrow,
        endDate: weekEnd,
        days: 4,
        status: 'pending',
        reason: 'LPG plant shutdown coordination',
      },
      {
        employeeId: e2.id,
        leaveTypeId: annualLeave.id,
        startDate: tomorrow,
        endDate: weekEnd,
        days: 3,
        status: 'pending',
        reason: 'Family commitment',
      },
      {
        employeeId: e3.id,
        leaveTypeId: annualLeave.id,
        startDate: new Date(`${todayStr}T00:00:00.000Z`),
        endDate: new Date(`${todayStr}T23:59:59.999Z`),
        days: 1,
        status: 'approved',
        reason: 'Medical appointment',
      },
    ],
  });

  console.log(
    `\nStabex demo seeded on client "${client.id}" — ${WORKFORCE.length} employees, attendance today (${todayStr}), payroll ${year}-${padNum(month, 2)}, leave samples.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
