import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import {
  buildClientStatement,
  buildVendorStatement,
  sumAgeingBuckets,
} from '@/lib/accounts/statements';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  try {
    const clientId = request.nextUrl.searchParams.get('clientId')?.trim() || undefined;
    const type = request.nextUrl.searchParams.get('type')?.trim() || 'client';

    if (type === 'client') {
      const where = clientId ? { id: clientId } : undefined;
      const clients = await prisma.accountsClient.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          contactEmail: true,
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              issueDate: true,
              dueDate: true,
              status: true,
              currency: true,
              vatRateBps: true,
              totalOverrideIncVat: true,
              lines: { select: { amountExVat: true } },
              allocations: { select: { amount: true } },
              creditNotes: { select: { totalIncVat: true } },
            },
            orderBy: { issueDate: 'asc' },
          },
          clientPayments: {
            select: {
              id: true,
              receivedAt: true,
              amount: true,
              reference: true,
              method: true,
            },
            orderBy: { receivedAt: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        take: 100,
      });

      const statements = clients.map((c) => buildClientStatement(c));
      return NextResponse.json({ statements, ageingSummary: sumAgeingBuckets(statements) });
    }

    if (type === 'vendor') {
      const vendorId = request.nextUrl.searchParams.get('vendorId')?.trim() || undefined;
      const vendors = await prisma.accountsVendor.findMany({
        where: vendorId ? { id: vendorId } : undefined,
        select: {
          id: true,
          name: true,
          currency: true,
          contactEmail: true,
          bills: {
            select: {
              id: true,
              billRef: true,
              issueDate: true,
              dueDate: true,
              status: true,
              vatRateBps: true,
              lines: { select: { amountExVat: true } },
              allocations: { select: { amount: true } },
            },
            orderBy: { issueDate: 'asc' },
          },
          payments: {
            select: {
              id: true,
              paidAt: true,
              amount: true,
              reference: true,
              method: true,
            },
            orderBy: { paidAt: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        take: 100,
      });

      const statements = vendors.map((v) => buildVendorStatement(v));
      return NextResponse.json({ statements, ageingSummary: sumAgeingBuckets(statements) });
    }

    return NextResponse.json({ error: 'Invalid type. Use client or vendor.' }, { status: 400 });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/statements',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load statements.' }, { status: 500 });
  }
}
