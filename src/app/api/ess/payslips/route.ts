import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json([]);

    const { searchParams } = request.nextUrl;
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const statusParam = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));

    const where: {
      organizationId: string;
      employeeId: string;
      year?: number;
      month?: number;
      status?: 'draft' | 'approved' | 'paid';
    } = ctx.where({ employeeId: ctx.employeeId });
    if (yearParam && !Number.isNaN(Number(yearParam))) where.year = Number(yearParam);
    if (monthParam && !Number.isNaN(Number(monthParam))) where.month = Number(monthParam);
    if (statusParam === 'draft' || statusParam === 'approved' || statusParam === 'paid') {
      where.status = statusParam;
    }

    const [total, payrollRows] = await ctx.run((tx) =>
      Promise.all([
        tx.payroll.count({ where }),
        tx.payroll.findMany({
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
        }),
      ]),
    );

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
  });
}
