/**
 * Seeds the 6 employees from SABIC PAYROLL 2026 CSV into Summit Retail Kenya Ltd
 * (pseudo client from db:seed-one-outsourcing). Safe to re-run: replaces SABIC seed
 * employees only (by email domain @sabic-payroll.seed).
 *
 * Run after: npm run db:seed-one-outsourcing
 * Then:      npm run db:seed-sabic-payroll
 *
 * Optional: SABIC_CSV=/path/to/SABIC PAYROLL 2026.csv to read full file (row 3 = header).
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

const CLIENT_NAME = 'Summit Retail Kenya Ltd';
const EMAIL_DOMAIN = 'sabic-payroll.seed';

/** Parse CSV line respecting double-quoted fields */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
    } else if ((c === ',' && !inQ) || c === '\r') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseMoney(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function splitName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Employee' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 40);
}

async function loadRowsFromCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\n/).filter((l) => l.trim());
  let headerIdx = lines.findIndex((l) => l.startsWith('S/NO') || l.includes('Account Name'));
  if (headerIdx < 0) headerIdx = 2;
  const header = parseCsvLine(lines[headerIdx]);
  const idx = (name) => header.findIndex((h) => h.trim() === name);

  const iNo = idx('S/NO');
  const iName = idx('Account Name');
  const iPos = idx('Position');
  const iId = idx('ID No.');
  const iKra = idx('KRA PIN No.');
  const iNssf = idx('NSSF No.');
  const iNhif = idx('NHIF No.');
  const iShif = idx('SHIF NO');
  const iPhone = idx('Phone number');
  const iBank = idx('Bank Name');
  const iBranch = idx(' Branch Name ') >= 0 ? idx(' Branch Name ') : idx('Branch Name');
  const iAcct = idx('Account Number');
  const iSalary = idx('B/Salary');

  const rows = [];
  for (let r = headerIdx + 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const no = (cells[iNo] || '').trim();
    if (!/^\d{1,3}$/.test(no)) continue;
    const accountName = (cells[iName] || '').trim();
    if (!accountName || accountName.toLowerCase().includes('total')) continue;
    const baseSalary = parseMoney(cells[iSalary]);
    if (baseSalary == null || baseSalary <= 0) continue;
    rows.push({
      employeeNumber: no.padStart(3, '0'),
      accountName,
      jobTitle: (cells[iPos] || '').trim() || null,
      idNumber: (cells[iId] || '').trim() || null,
      kraPin: (cells[iKra] || '').trim() || null,
      nssfNumber: (cells[iNssf] || '').trim() || null,
      nhifNumber: (cells[iNhif] || '').trim() || null,
      shifNo: (cells[iShif] || '').trim() || null,
      phone: (cells[iPhone] || '').trim() || null,
      bankName: (cells[iBank] || '').trim() || null,
      bankBranch: iBranch >= 0 ? (cells[iBranch] || '').trim() || null : null,
      bankAccountNumber: (cells[iAcct] || '').trim() || null,
      baseSalary,
    });
  }
  return rows;
}

const EMBEDDED = [
  { employeeNumber: '001', accountName: 'FIONA ADONGO OCHIENG', jobTitle: 'CUSTOMER CARE EXECUTIVE', idNumber: '25983418', kraPin: 'A005526797Q', nssfNumber: '100202829', nhifNumber: '25983418', phone: '0724292270', bankName: 'EQUITY', bankBranch: 'FOURWAYS BRANCH', bankAccountNumber: '0020191396863', baseSalary: 110625 },
  { employeeNumber: '002', accountName: 'BONFACE ODHIAMBO OLOUCH', jobTitle: 'RECEPTIONIST', idNumber: '33073314', kraPin: 'A008752375G', nssfNumber: '2021048636', nhifNumber: null, phone: null, bankName: null, bankBranch: null, bankAccountNumber: null, baseSalary: 58746 },
  { employeeNumber: '003', accountName: 'JAMES CHITIBWA', jobTitle: 'OFFICE ASSISTANT', idNumber: '31231206', kraPin: null, nssfNumber: '2003173378', nhifNumber: '5110664', phone: '0712856129', bankName: 'COOP', bankBranch: 'WESTLANDS', bankAccountNumber: '01108153745700', baseSalary: 46795 },
  { employeeNumber: '004', accountName: 'JORAM MWANGI WAINAINA', jobTitle: 'DRIVER', idNumber: '30414013', kraPin: 'A013871789J', nssfNumber: '2027835147', nhifNumber: null, phone: '0718082778', bankName: 'I&M', bankBranch: 'CROSS ROAD', bankAccountNumber: '03403347056150', baseSalary: 42989 },
  { employeeNumber: '005', accountName: 'FIONA KEMUNTO MECHA', jobTitle: 'ACCOUNTANT', idNumber: '32814219', kraPin: 'A010246773W', nssfNumber: '2027247931', nhifNumber: null, phone: '0723291506', bankName: 'KCB', bankBranch: 'Kitengela', bankAccountNumber: '1256344230', baseSalary: 119923 },
  { employeeNumber: '006', accountName: 'JANE WANGECHI SAWAYA', jobTitle: 'RECEPTIONIST RELIEVER', idNumber: '38886900', kraPin: 'A019299530B', nssfNumber: '2063325776', nhifNumber: null, phone: '0790484738', bankName: 'EQUITY', bankBranch: 'KAYOLE BRANCH', bankAccountNumber: '0650187012056', baseSalary: 58746 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = await prisma.outsourcingClient.findFirst({
    where: { name: CLIENT_NAME },
    include: { departments: true },
  });
  if (!client) {
    console.error(`Client "${CLIENT_NAME}" not found. Run: npm run db:seed-one-outsourcing`);
    process.exit(1);
  }

  let rows;
  const envCsv = process.env.SABIC_CSV;
  const bundled = path.join(__dirname, 'data', 'sabic-payroll-2026.csv');
  const desktop = path.join(process.env.HOME || '', 'Desktop', 'SABIC PAYROLL 2026.csv');
  const csvPath = envCsv && fs.existsSync(envCsv) ? envCsv : fs.existsSync(desktop) ? desktop : bundled;

  try {
    if (fs.existsSync(csvPath)) {
      rows = await loadRowsFromCsv(csvPath);
      console.log(`Loaded ${rows.length} row(s) from ${csvPath}`);
    }
  } catch (e) {
    console.warn('CSV parse failed, using embedded rows:', e.message);
  }
  if (!rows || rows.length === 0) rows = EMBEDDED;

  const deptOps = client.departments.find((d) => /operations/i.test(d.name));
  const departmentId = deptOps?.id ?? client.departments[0]?.id ?? null;

  const deleted = await prisma.employee.deleteMany({
    where: {
      outsourcingClientId: client.id,
      email: { endsWith: `@${EMAIL_DOMAIN}` },
    },
  });
  if (deleted.count) console.log(`Removed ${deleted.count} previous SABIC seed employee(s).`);

  for (const row of rows) {
    const { firstName, lastName } = splitName(row.accountName);
    const email = `${slug(firstName)}.${slug(lastName)}.${row.employeeNumber}@${EMAIL_DOMAIN}`;
    const nhif = row.nhifNumber || row.shifNo || null;
    await prisma.employee.create({
      data: {
        outsourcingClientId: client.id,
        departmentId,
        employeeNumber: `SRK-${row.employeeNumber}`,
        firstName,
        lastName,
        email,
        phone: row.phone || `+254700000${row.employeeNumber}`,
        idNumber: row.idNumber,
        kraPin: row.kraPin,
        nssfNumber: row.nssfNumber,
        nhifNumber: nhif && nhif.length < 80 ? nhif : row.nssfNumber,
        jobTitle: row.jobTitle,
        bankName: row.bankName,
        bankBranch: row.bankBranch,
        bankAccountNumber: row.bankAccountNumber,
        baseSalary: new Decimal(row.baseSalary),
        dateOfJoining: new Date('2025-06-01'),
      },
    });
    console.log(`  + ${row.employeeNumber} ${row.accountName} — KES ${row.baseSalary.toLocaleString()}`);
  }

  console.log(`\nDone. ${rows.length} employees on "${CLIENT_NAME}".`);
  console.log(`Payroll: Outsourcing → Payroll → client Summit → Generate January 2026.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
