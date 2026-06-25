import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import { buildClientStatement, buildVendorStatement } from '@/lib/accounts/statements';
import { generateClientStatementPdf, generateVendorStatementPdf } from '@/lib/account-statement-pdf';
import { sendAccountStatementEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const toOverride = typeof body.to === 'string' ? body.to.trim() : '';

    if (type !== 'client' && type !== 'vendor') {
      return NextResponse.json({ error: 'type must be client or vendor.' }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

    if (type === 'client') {
      const client = await prisma.accountsClient.findUnique({
        where: { id },
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
      });
      if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

      const statement = buildClientStatement(client);
      const to = toOverride || statement.contactEmail;
      if (!to) {
        return NextResponse.json({ error: 'No contact email on file. Provide a to address.' }, { status: 400 });
      }

      const pdf = await generateClientStatementPdf(statement);
      const result = await sendAccountStatementEmail({
        to,
        partyName: statement.clientName,
        partyType: 'client',
        currency: statement.currency,
        closingBalance: statement.summary.closingBalance,
        pdfBuffer: pdf,
        pdfFilename: `Statement_${statement.clientName.replace(/\s+/g, '_')}.pdf`,
      });

      if (!result.sent) {
        return NextResponse.json({ error: result.error || 'Email not sent.', reason: result.reason }, { status: 502 });
      }
      return NextResponse.json({ success: true, to, messageId: result.messageId ?? null });
    }

    const vendor = await prisma.accountsVendor.findUnique({
      where: { id },
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
    });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });

    const statement = buildVendorStatement(vendor);
    const to = toOverride || statement.contactEmail;
    if (!to) {
      return NextResponse.json({ error: 'No contact email on file. Provide a to address.' }, { status: 400 });
    }

    const pdf = await generateVendorStatementPdf(statement);
    const result = await sendAccountStatementEmail({
      to,
      partyName: statement.vendorName,
      partyType: 'vendor',
      currency: statement.currency,
      closingBalance: statement.summary.closingBalance,
      pdfBuffer: pdf,
      pdfFilename: `Statement_${statement.vendorName.replace(/\s+/g, '_')}.pdf`,
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error || 'Email not sent.', reason: result.reason }, { status: 502 });
    }
    return NextResponse.json({ success: true, to, messageId: result.messageId ?? null });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/statements/email',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to send statement.' }, { status: 500 });
  }
}
