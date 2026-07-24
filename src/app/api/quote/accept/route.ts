import { NextRequest, NextResponse } from 'next/server';
import { withQuoteAcceptContext } from '@/lib/sales/quote-accept-token';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

function lineAmount(li: {
  quantity: unknown;
  unitPrice: unknown;
  discountPct: unknown;
  isRecurring: boolean;
  termMonths: number | null;
}) {
  const base =
    Number(li.quantity) *
    Number(li.unitPrice) *
    (1 - Math.min(100, Math.max(0, Number(li.discountPct))) / 100);
  const months = li.isRecurring && li.termMonths && li.termMonths > 0 ? li.termMonths : 1;
  return round2(base * months);
}

function computeTotals(
  discountPct: number,
  taxRateBps: number,
  lineItems: Array<{
    quantity: unknown;
    unitPrice: unknown;
    discountPct: unknown;
    isRecurring: boolean;
    termMonths: number | null;
  }>,
) {
  const subtotal = round2(lineItems.reduce((sum, li) => sum + lineAmount(li), 0));
  const pct = Math.min(100, Math.max(0, discountPct));
  const discountAmount = round2((subtotal * pct) / 100);
  const netAmount = round2(subtotal - discountAmount);
  const taxAmount = round2((netAmount * Math.max(0, taxRateBps)) / 10000);
  const total = round2(netAmount + taxAmount);
  return { subtotal, discountAmount, netAmount, taxAmount, total };
}

function resolveFailureResponse(reason: 'invalid_token' | 'not_found') {
  if (reason === 'invalid_token') {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
}

/** GET: Validate token and return public quote summary for e-accept (B3). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim() || '';
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  const resolved = await withQuoteAcceptContext(token, async ({ tx, quoteId, organizationId }) => {
    const quote = await tx.salesQuote.findFirst({
      where: { id: quoteId, organizationId },
      include: {
        accountsClient: { select: { name: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!quote) return { kind: 'not_found' as const };
    if (quote.supersededById) {
      return { kind: 'superseded' as const };
    }

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const totals = computeTotals(Number(quote.discountPct), quote.taxRateBps, quote.lineItems);

    return {
      kind: 'ok' as const,
      body: {
        valid: true,
        quoteNumber: quote.quoteNumber,
        version: quote.version,
        title: quote.title,
        status: quote.status,
        currency: quote.currency,
        issueDate: quote.issueDate.toISOString(),
        validUntil: quote.validUntil?.toISOString() ?? null,
        taxRateBps: quote.taxRateBps,
        discountPct: Number(quote.discountPct),
        notes: quote.notes,
        terms: quote.terms,
        acceptedAt: quote.acceptedAt?.toISOString() ?? null,
        acceptedByName: quote.acceptedByName,
        clientName: quote.accountsClient?.name ?? 'Prospective client',
        companyName: org?.name ?? 'Stride',
        lineItems: quote.lineItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          discountPct: Number(li.discountPct),
          isRecurring: li.isRecurring,
          termMonths: li.termMonths,
          amount: lineAmount(li),
        })),
        totals,
      },
    };
  });

  if (!resolved.ok) return resolveFailureResponse(resolved.reason);
  if (resolved.result.kind === 'not_found') {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  }
  if (resolved.result.kind === 'superseded') {
    return NextResponse.json(
      { error: 'This quote has been superseded by a newer revision.' },
      { status: 410 },
    );
  }
  return NextResponse.json(resolved.result.body);
}

/**
 * POST: Accept quote via public token — stamps acceptedAt + name, logs deal activity (B3).
 * Owner notification deferred to Phase E3 (no sales NotificationEvent yet).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as { token?: string; acceptedByName?: string };
  const token = typeof b.token === 'string' ? b.token.trim() : '';
  const acceptedByName =
    typeof b.acceptedByName === 'string' ? b.acceptedByName.trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }
  if (!acceptedByName || acceptedByName.length < 2) {
    return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  const resolved = await withQuoteAcceptContext(token, async ({ tx, quoteId, organizationId }) => {
    const quote = await tx.salesQuote.findFirst({
      where: { id: quoteId, organizationId },
      include: {
        deal: { select: { id: true, ownerEmployeeId: true, organizationId: true } },
      },
    });
    if (!quote) return { kind: 'not_found' as const };
    if (quote.supersededById) {
      return { kind: 'superseded' as const };
    }
    if (quote.status !== 'sent' && quote.status !== 'accepted') {
      return { kind: 'not_open' as const };
    }
    if (quote.acceptedAt) {
      return {
        kind: 'already' as const,
        acceptedAt: quote.acceptedAt.toISOString(),
        acceptedByName: quote.acceptedByName,
      };
    }

    const now = new Date();
    await tx.salesQuote.update({
      where: { id: quoteId },
      data: {
        status: 'accepted',
        acceptedAt: now,
        acceptedByName,
        sentAt: quote.sentAt ?? now,
      },
    });

    if (quote.dealId && quote.deal?.ownerEmployeeId) {
      await tx.salesDealActivity.create({
        data: {
          organizationId,
          dealId: quote.dealId,
          type: 'note',
          subject: `Quote Q-${String(quote.quoteNumber).padStart(4, '0')} v${quote.version} accepted`,
          body: `Accepted electronically by ${acceptedByName} on ${now.toISOString()}.`,
          actorEmployeeId: quote.deal.ownerEmployeeId,
        },
      });
      await tx.salesDeal.update({
        where: { id: quote.dealId },
        data: { lastActivityAt: now },
      });
    }

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: null,
        actorEmail: null,
        action: 'sales.quote.e_accepted',
        entityType: 'SalesQuote',
        entityId: quoteId,
        route: '/api/quote/accept',
        metadata: { acceptedByName, quoteNumber: quote.quoteNumber, version: quote.version },
      },
    });

    return {
      kind: 'ok' as const,
      acceptedAt: now.toISOString(),
      acceptedByName,
    };
  });

  if (!resolved.ok) return resolveFailureResponse(resolved.reason);
  const result = resolved.result;
  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  }
  if (result.kind === 'superseded') {
    return NextResponse.json(
      { error: 'This quote has been superseded by a newer revision.' },
      { status: 410 },
    );
  }
  if (result.kind === 'not_open') {
    return NextResponse.json(
      { error: 'This quote is not open for acceptance.' },
      { status: 400 },
    );
  }
  if (result.kind === 'already') {
    return NextResponse.json({
      success: true,
      alreadyAccepted: true,
      message: 'This quote was already accepted.',
      acceptedAt: result.acceptedAt,
      acceptedByName: result.acceptedByName,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Thank you — this quote has been accepted.',
    acceptedAt: result.acceptedAt,
    acceptedByName: result.acceptedByName,
  });
}
