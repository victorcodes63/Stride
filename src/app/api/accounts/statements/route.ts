import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';

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
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              issueDate: true,
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

      const statements = clients.map((c) => {
        let runningBalance = 0;
        const entries: Array<{
          date: string;
          type: string;
          reference: string;
          description: string;
          debit: number;
          credit: number;
          balance: number;
        }> = [];

        const allItems: Array<{
          date: Date;
          type: string;
          reference: string;
          description: string;
          debit: number;
          credit: number;
        }> = [];

        for (const inv of c.invoices) {
          const subtotal = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
          const vatAmount = Math.round(subtotal * (inv.vatRateBps / 10000) * 100) / 100;
          const total = inv.totalOverrideIncVat ? Number(inv.totalOverrideIncVat) : subtotal + vatAmount;
          allItems.push({
            date: inv.issueDate,
            type: 'invoice',
            reference: `INV-${String(inv.invoiceNumber).padStart(4, '0')}`,
            description: `Invoice #${inv.invoiceNumber}`,
            debit: total,
            credit: 0,
          });
          for (const cn of inv.creditNotes) {
            allItems.push({
              date: inv.issueDate,
              type: 'credit_note',
              reference: `CN on INV-${String(inv.invoiceNumber).padStart(4, '0')}`,
              description: `Credit note`,
              debit: 0,
              credit: Number(cn.totalIncVat),
            });
          }
        }

        for (const pmt of c.clientPayments) {
          allItems.push({
            date: pmt.receivedAt,
            type: 'payment',
            reference: pmt.reference || pmt.method || 'Payment',
            description: `Payment received${pmt.method ? ` (${pmt.method})` : ''}`,
            debit: 0,
            credit: Number(pmt.amount),
          });
        }

        allItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const item of allItems) {
          runningBalance += item.debit - item.credit;
          entries.push({
            date: new Date(item.date).toISOString().split('T')[0]!,
            type: item.type,
            reference: item.reference,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            balance: Math.round(runningBalance * 100) / 100,
          });
        }

        const totalDebits = allItems.reduce((s, i) => s + i.debit, 0);
        const totalCredits = allItems.reduce((s, i) => s + i.credit, 0);

        return {
          clientId: c.id,
          clientName: c.name,
          clientType: c.type,
          currency: c.currency,
          entries,
          summary: {
            totalInvoiced: Math.round(totalDebits * 100) / 100,
            totalPaid: Math.round(totalCredits * 100) / 100,
            closingBalance: Math.round(runningBalance * 100) / 100,
          },
        };
      });

      return NextResponse.json({ statements });
    }

    if (type === 'vendor') {
      const vendors = await prisma.accountsVendor.findMany({
        select: {
          id: true,
          name: true,
          currency: true,
          bills: {
            select: {
              id: true,
              billRef: true,
              issueDate: true,
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

      const statements = vendors.map((v) => {
        let runningBalance = 0;
        const allItems: Array<{
          date: Date;
          type: string;
          reference: string;
          description: string;
          debit: number;
          credit: number;
        }> = [];

        for (const bill of v.bills) {
          const subtotal = bill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
          const vatAmount = Math.round(subtotal * (bill.vatRateBps / 10000) * 100) / 100;
          const total = subtotal + vatAmount;
          allItems.push({
            date: bill.issueDate,
            type: 'bill',
            reference: bill.billRef || 'Bill',
            description: `Vendor bill${bill.billRef ? ` ${bill.billRef}` : ''}`,
            debit: total,
            credit: 0,
          });
        }

        for (const pmt of v.payments) {
          allItems.push({
            date: pmt.paidAt,
            type: 'payment',
            reference: pmt.reference || 'Payment',
            description: `Payment made${pmt.method ? ` (${pmt.method})` : ''}`,
            debit: 0,
            credit: Number(pmt.amount),
          });
        }

        allItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const entries = allItems.map((item) => {
          runningBalance += item.debit - item.credit;
          return {
            date: new Date(item.date).toISOString().split('T')[0]!,
            type: item.type,
            reference: item.reference,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            balance: Math.round(runningBalance * 100) / 100,
          };
        });

        const totalDebits = allItems.reduce((s, i) => s + i.debit, 0);
        const totalCredits = allItems.reduce((s, i) => s + i.credit, 0);

        return {
          vendorId: v.id,
          vendorName: v.name,
          currency: v.currency,
          entries,
          summary: {
            totalBilled: Math.round(totalDebits * 100) / 100,
            totalPaid: Math.round(totalCredits * 100) / 100,
            closingBalance: Math.round(runningBalance * 100) / 100,
          },
        };
      });

      return NextResponse.json({ statements });
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
