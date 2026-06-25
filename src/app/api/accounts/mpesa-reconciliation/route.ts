import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { isMpesaMethod, matchMpesaReferences } from '@/lib/accounts/mpesa-reconciliation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const month = parseInt(request.nextUrl.searchParams.get('month') ?? '', 10);
  const year = parseInt(request.nextUrl.searchParams.get('year') ?? '', 10);
  const now = new Date();
  const filterMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1;
  const filterYear = Number.isFinite(year) && year >= 2000 ? year : now.getUTCFullYear();

  const disbursementLines = await prisma.payrollDisbursementLine.findMany({
    where: {
      batch: { channel: 'mpesa' },
      payroll: { month: filterMonth, year: filterYear },
    },
    include: {
      batch: { select: { id: true, status: true } },
      payroll: { select: { month: true, year: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const clientPayments = await prisma.accountsClientPayment.findMany({
    where: {
      receivedAt: {
        gte: new Date(Date.UTC(filterYear, filterMonth - 1, 1)),
        lt: new Date(Date.UTC(filterYear, filterMonth, 1)),
      },
    },
    include: {
      client: { select: { name: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 500,
  });

  const mpesaReceipts = clientPayments.filter((p) => isMpesaMethod(p.method));
  const matches = matchMpesaReferences(
    disbursementLines.map((l) => ({ lineId: l.id, providerRef: l.providerRef })),
    mpesaReceipts.map((p) => ({ paymentId: p.id, reference: p.reference })),
  );

  const matchedLineIds = new Set(matches.values());

  return NextResponse.json({
    period: { month: filterMonth, year: filterYear },
    disbursements: disbursementLines.map((l) => ({
      lineId: l.id,
      batchId: l.batch.id,
      batchStatus: l.batch.status,
      payrollMonth: l.payroll.month,
      payrollYear: l.payroll.year,
      employeeName: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
      amount: Number(l.amount),
      phone: l.phone,
      providerRef: l.providerRef,
      status: l.status,
      reconciled: l.providerRef ? matchedLineIds.has(l.id) : false,
    })),
    receipts: mpesaReceipts.map((p) => {
      const allocated = p.allocations.reduce((s, a) => s + Number(a.amount), 0);
      const amount = Number(p.amount);
      return {
        paymentId: p.id,
        clientName: p.client.name,
        receivedAt: p.receivedAt.toISOString().slice(0, 10),
        amount,
        reference: p.reference,
        method: p.method,
        allocatedTotal: allocated,
        unmatchedBalance: Math.max(0, Math.round((amount - allocated) * 100) / 100),
        matchedDisbursementLineId: matches.get(p.id) ?? null,
      };
    }),
    summary: {
      disbursementCount: disbursementLines.length,
      receiptCount: mpesaReceipts.length,
      matchedPairs: matches.size,
      unreconciledDisbursements: disbursementLines.filter(
        (l) => l.providerRef && !matchedLineIds.has(l.id),
      ).length,
    },
  });
}
