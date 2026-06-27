import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  buildClientStatement,
  buildVendorStatement,
  sumAgeingBuckets,
} from '@/lib/accounts/statements';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    try {
      const clientId = request.nextUrl.searchParams.get('clientId')?.trim() || undefined;
      const type = request.nextUrl.searchParams.get('type')?.trim() || 'client';

      if (type === 'client') {
        const clients = await ctx.run((tx) =>
          tx.accountsClient.findMany({
            where: ctx.where(clientId ? { id: clientId } : {}),
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
          }),
        );

        const statements = clients.map((c) => buildClientStatement(c));
        return NextResponse.json({ statements, ageingSummary: sumAgeingBuckets(statements) });
      }

      if (type === 'vendor') {
        const vendorId = request.nextUrl.searchParams.get('vendorId')?.trim() || undefined;
        const vendors = await ctx.run((tx) =>
          tx.accountsVendor.findMany({
            where: ctx.where(vendorId ? { id: vendorId } : {}),
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
          }),
        );

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
  });
}
