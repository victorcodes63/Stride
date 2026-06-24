import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ year: new Date().getFullYear(), totals: null, months: [] });
  }

  const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getFullYear();

  const rows = await prisma.payroll.findMany({
    where: {
      employeeId: user.employeeId,
      year,
      status: { in: ['approved', 'paid'] },
    },
    orderBy: { month: 'asc' },
    select: {
      month: true,
      grossPay: true,
      netPay: true,
      paye: true,
      nssf: true,
      nhif: true,
      basicPay: true,
    },
  });

  const sum = (key: 'grossPay' | 'netPay' | 'paye' | 'nssf' | 'nhif' | 'basicPay') =>
    rows.reduce((acc, r) => acc + Number(r[key]), 0);

  return NextResponse.json({
    year,
    totals: {
      grossPay: sum('grossPay'),
      netPay: sum('netPay'),
      paye: sum('paye'),
      nssf: sum('nssf'),
      nhif: sum('nhif'),
      basicPay: sum('basicPay'),
      monthsPaid: rows.length,
    },
    months: rows.map((r) => ({
      month: r.month,
      grossPay: Number(r.grossPay),
      netPay: Number(r.netPay),
    })),
  });
}
