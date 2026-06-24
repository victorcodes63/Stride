import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);

  const { searchParams } = request.nextUrl;
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const statusParam = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));

  const where: {
    employeeId: string;
    year?: number;
    month?: number;
    status?: 'draft' | 'approved' | 'paid';
  } = { employeeId: user.employeeId };
  if (yearParam && !Number.isNaN(Number(yearParam))) where.year = Number(yearParam);
  if (monthParam && !Number.isNaN(Number(monthParam))) where.month = Number(monthParam);
  if (statusParam === 'draft' || statusParam === 'approved' || statusParam === 'paid') {
    where.status = statusParam;
  }

  const total = await prisma.payroll.count({ where });
  const payrollRows = await prisma.payroll.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      month: true,
      year: true,
      basicPay: true,
      grossPay: true,
      netPay: true,
      paye: true,
      nssf: true,
      nhif: true,
      ahl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    items: payrollRows.map((row) => ({
      id: row.id,
      month: row.month,
      year: row.year,
      basicPay: Number(row.basicPay),
      grossPay: Number(row.grossPay),
      netPay: Number(row.netPay),
      paye: Number(row.paye),
      nssf: Number(row.nssf),
      nhif: Number(row.nhif),
      ahl: Number(row.ahl),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
