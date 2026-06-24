/**
 * RAV-129 — Reconcile seeded payroll statutory fields against payroll-calc + country_config.
 * Run: npm run payroll:verify-statutory
 */
import { PrismaClient } from '@prisma/client';
import { CountryPackKind } from '@prisma/client';
import { calculateStatutoryForPayroll } from '../src/lib/payroll-calc';
import { DEFAULT_KENYA_STATUTORY_RATES, getStatutoryRates } from '../src/lib/country-config';

const MONTH = Number(process.env.VERIFY_PAYROLL_MONTH ?? 3);
const YEAR = Number(process.env.VERIFY_PAYROLL_YEAR ?? 2026);
const TOLERANCE = 0.01;

type Allowance = { name: string; amount: number };
type Deduction = { name: string; amount: number };

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function sumJsonAmounts(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    const amount = typeof row === 'object' && row && 'amount' in row ? num((row as { amount: unknown }).amount) : 0;
    return sum + amount;
  }, 0);
}

function employmentGrossFromPayroll(row: {
  basicPay: unknown;
  allowances: unknown;
  period1Gross: unknown;
  period2Gross: unknown;
}): number {
  const p1 = row.period1Gross != null ? num(row.period1Gross) : null;
  const p2 = row.period2Gross != null ? num(row.period2Gross) : null;
  if (p1 != null || p2 != null) return (p1 ?? 0) + (p2 ?? 0);
  return num(row.basicPay) + sumJsonAmounts(row.allowances);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');

  const db = new PrismaClient({ datasources: { db: { url } } });
  const asOf = new Date(Date.UTC(YEAR, MONTH - 1, 15));

  try {
    const rates = await getStatutoryRates('KE', asOf);
    const configRow = await db.countryConfig.findFirst({
      where: {
        country: 'KE',
        kind: CountryPackKind.statutory,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    console.log(`\nRAV-129 payroll statutory verify — ${MONTH}/${YEAR} (as-of ${asOf.toISOString().slice(0, 10)})\n`);

    if (!configRow) {
      console.log('⚠ No country_config statutory row for KE — using DEFAULT_KENYA_STATUTORY_RATES');
    } else {
      console.log(`✓ country_config KE statutory effectiveFrom=${configRow.effectiveFrom.toISOString().slice(0, 10)}`);
    }

    const defaultsMatch =
      JSON.stringify(rates) === JSON.stringify(DEFAULT_KENYA_STATUTORY_RATES) ||
      JSON.stringify(rates.payeBands) === JSON.stringify(DEFAULT_KENYA_STATUTORY_RATES.payeBands);
    if (!defaultsMatch) {
      console.log('⚠ DB statutory config differs from DEFAULT_KENYA_STATUTORY_RATES — payroll uses DB values');
    }

    const payrolls = await db.payroll.findMany({
      where: { month: MONTH, year: YEAR },
      include: {
        employee: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { grossPay: 'desc' },
    });

    if (!payrolls.length) {
      throw new Error(`No payroll rows for ${MONTH}/${YEAR}. Run seed:demo:imara-sacco first.`);
    }

    console.log(`Checking ${payrolls.length} payroll rows…\n`);

    const mismatches: string[] = [];
    let checked = 0;

    for (const row of payrolls) {
      const employmentGross = employmentGrossFromPayroll(row);
      const leavePay = num(row.leavePay);
      const otherDeductions = sumJsonAmounts(row.deductions);
      const expected = calculateStatutoryForPayroll('none', employmentGross, leavePay, otherDeductions, rates);

      const fields = ['paye', 'nssf', 'nhif', 'ahl', 'nita', 'netPay', 'grossPay'] as const;
      for (const field of fields) {
        const stored = num(row[field]);
        const want = field === 'grossPay' ? expected.grossPay : num(expected[field === 'nhif' ? 'nhif' : field]);
        if (Math.abs(stored - want) > TOLERANCE) {
          mismatches.push(
            `${row.employee.email} ${field}: stored=${stored} expected=${want} (gross=${employmentGross})`,
          );
        }
      }
      checked += 1;
    }

    if (mismatches.length) {
      console.log(`✗ ${mismatches.length} field mismatch(es):\n`);
      for (const line of mismatches.slice(0, 20)) console.log(`  ${line}`);
      if (mismatches.length > 20) console.log(`  … and ${mismatches.length - 20} more`);
      process.exitCode = 1;
    } else {
      console.log(`✓ All ${checked} payroll rows match calculateStatutoryForPayroll('none', …)`);
    }

    // Sample payslip for hand review (highest gross + mid-tier + low)
    const samples = [
      payrolls[0],
      payrolls[Math.floor(payrolls.length / 2)],
      payrolls[payrolls.length - 1],
    ].filter(Boolean);

    console.log('\n--- Sample payslips (hand-check reference) ---\n');
    for (const row of samples) {
      const employmentGross = employmentGrossFromPayroll(row);
      const calc = calculateStatutoryForPayroll('none', employmentGross, 0, 0, rates);
      const name = `${row.employee.firstName} ${row.employee.lastName}`;
      console.log(`${name} <${row.employee.email}>`);
      console.log(`  Employment gross: KES ${employmentGross.toLocaleString('en-KE')}`);
      console.log(`  NSSF (Tier I+II): KES ${calc.nssf.toLocaleString('en-KE')}`);
      console.log(`  SHIF (2.75%):     KES ${calc.nhif.toLocaleString('en-KE')}`);
      console.log(`  AHL (1.5%):       KES ${calc.ahl.toLocaleString('en-KE')}`);
      console.log(`  PAYE:             KES ${calc.paye.toLocaleString('en-KE')}`);
      console.log(`  NITA (employer):  KES ${calc.nita.toLocaleString('en-KE')}`);
      console.log(`  Net pay:          KES ${calc.netPay.toLocaleString('en-KE')}`);
      console.log('');
    }

    console.log('Rates in effect:');
    console.log(`  PAYE bands: ${rates.payeBands.map((b) => `${b.rate * 100}% ≤ ${b.max === Infinity ? '∞' : b.max}`).join(', ')}`);
    console.log(`  Personal relief: KES ${rates.personalRelief}`);
    console.log(`  NSSF: ${rates.nssfRate * 100}% on Tier I (≤${rates.nssfTier1Limit}) + Tier II (≤${rates.nssfTier2Limit})`);
    console.log(`  SHIF: ${rates.shifRate * 100}% | AHL: ${rates.ahlRate * 100}% | NITA: KES ${rates.nitaPerEmployee}/employee\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
