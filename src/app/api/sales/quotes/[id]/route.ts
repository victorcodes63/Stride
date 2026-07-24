import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { canViewSalesMargin } from '@/lib/sales/access';
import {
  computeEffectiveDiscountPct,
  ensureApprovalPolicy,
  resolveApprovalRequirement,
  resolveQuoteApproverNote,
} from '@/lib/sales/quote-approval';
import { createQuoteAcceptToken } from '@/lib/sales/quote-accept-token';
import { SALES_QUOTE_STATUSES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';
import { computeQuoteTotals } from '../route';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const quoteInclude = {
  accountsClient: { select: { id: true, name: true, currency: true } },
  deal: { select: { id: true, name: true, stage: true } },
  createdBy: { select: { id: true, name: true } },
  lineItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      product: { select: { id: true, name: true, sku: true, costPrice: true } },
    },
  },
} as const;

type QuoteWithRelations = {
  id: string;
  quoteNumber: number;
  version: number;
  supersededById: string | null;
  title: string;
  status: string;
  currency: string;
  dealId: string | null;
  accountsClientId: string | null;
  accountsInvoiceId: string | null;
  issueDate: Date;
  validUntil: Date | null;
  discountPct: unknown;
  taxRateBps: number;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  acceptedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  accountsClient: { id: string; name: string; currency: string } | null;
  deal: { id: string; name: string; stage: string } | null;
  createdBy: { id: string; name: string } | null;
  lineItems: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    discountPct: unknown;
    priceOverridden: boolean;
    isRecurring: boolean;
    termMonths: number | null;
    sortOrder: number;
    product: {
      id: string;
      name: string;
      sku: string | null;
      costPrice?: unknown;
    } | null;
  }>;
};

function mapQuote(quote: QuoteWithRelations, options?: { includeCost?: boolean }) {
  const includeCost = options?.includeCost === true;
  const lineItems = quote.lineItems.map((li) => {
    const unitPrice = Number(li.unitPrice);
    const costRaw = li.product?.costPrice;
    const costPrice =
      includeCost && costRaw != null && Number.isFinite(Number(costRaw))
        ? Number(costRaw)
        : null;
    return {
      id: li.id,
      productId: li.productId,
      product: li.product
        ? { id: li.product.id, name: li.product.name, sku: li.product.sku }
        : null,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice,
      discountPct: Number(li.discountPct),
      priceOverridden: li.priceOverridden === true,
      isRecurring: li.isRecurring,
      termMonths: li.termMonths,
      sortOrder: li.sortOrder,
      ...(includeCost
        ? {
            costPrice,
            margin:
              costPrice != null ? Math.round((unitPrice - costPrice) * 100) / 100 : null,
          }
        : {}),
    };
  });
  const totals = computeQuoteTotals(Number(quote.discountPct), quote.taxRateBps, quote.lineItems);
  const readOnly = Boolean(quote.supersededById);
  const acceptPath =
    !readOnly && (quote.status === 'sent' || quote.status === 'accepted')
      ? `/quote/${createQuoteAcceptToken(quote.id)}`
      : null;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    version: quote.version,
    supersededById: quote.supersededById,
    readOnly,
    title: quote.title,
    status: quote.status,
    currency: quote.currency,
    dealId: quote.dealId,
    deal: quote.deal,
    accountsClientId: quote.accountsClientId,
    accountsClient: quote.accountsClient,
    accountsInvoiceId: quote.accountsInvoiceId,
    issueDate: quote.issueDate.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    discountPct: Number(quote.discountPct),
    taxRateBps: quote.taxRateBps,
    notes: quote.notes,
    terms: quote.terms,
    sentAt: quote.sentAt?.toISOString() ?? null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    acceptedByName: quote.acceptedByName,
    acceptPath,
    createdBy: quote.createdBy
      ? { id: quote.createdBy.id, name: quote.createdBy.name }
      : null,
    lineItems,
    totals,
    canViewMargin: includeCost,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Allowed status transitions for a quote lifecycle (B2 adds pending_approval). */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'pending_approval', 'expired'],
  pending_approval: ['sent', 'draft', 'expired'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['sent'],
  rejected: ['draft', 'sent'],
  expired: ['draft', 'sent'],
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    const includeCost = await canViewSalesMargin(ctx.staff);
    try {
      const quote = await ctx.run((tx) =>
        tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: quoteInclude,
        }),
      );
      if (!quote) {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      return NextResponse.json({
        quote: mapQuote(quote as QuoteWithRelations, { includeCost }),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load quote.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const nextStatus =
      typeof body.status === 'string' && SALES_QUOTE_STATUSES.includes(body.status as never)
        ? (body.status as string)
        : null;

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: {
            lineItems: {
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                discountPct: true,
                isRecurring: true,
                termMonths: true,
              },
            },
          },
        });
        if (!existing) return { kind: 'not_found' as const };
        if (existing.supersededById) {
          return { kind: 'read_only' as const };
        }

        const data: Prisma.SalesQuoteUncheckedUpdateInput = {};

        if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
        if ('accountsClientId' in body)
          data.accountsClientId =
            typeof body.accountsClientId === 'string'
              ? body.accountsClientId.trim() || null
              : null;
        if ('dealId' in body)
          data.dealId = typeof body.dealId === 'string' ? body.dealId.trim() || null : null;
        if (typeof body.currency === 'string' && body.currency.trim())
          data.currency = body.currency.trim();
        if ('discountPct' in body) {
          const p = Number(body.discountPct);
          if (Number.isFinite(p) && p >= 0) data.discountPct = Math.min(100, p);
        }
        if ('taxRateBps' in body) {
          const t = Number(body.taxRateBps);
          if (Number.isFinite(t) && t >= 0) data.taxRateBps = Math.round(t);
        }
        if ('notes' in body)
          data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
        if ('terms' in body)
          data.terms = typeof body.terms === 'string' ? body.terms.trim() || null : null;
        if ('issueDate' in body) {
          const d = parseDate(body.issueDate);
          if (d) data.issueDate = d;
        }
        if ('validUntil' in body) data.validUntil = parseDate(body.validUntil);

        let effectiveDiscountPct: number | null = null;

        if (nextStatus && nextStatus !== existing.status) {
          // B2 — gate "send" on discount policy before applying the transition.
          if (nextStatus === 'sent') {
            const headerDisc =
              data.discountPct != null ? Number(data.discountPct) : Number(existing.discountPct);
            const lines = existing.lineItems.map((li) => ({
              productId: li.productId,
              quantity: Number(li.quantity),
              unitPrice: Number(li.unitPrice),
              discountPct: Number(li.discountPct),
              isRecurring: li.isRecurring,
              termMonths: li.termMonths,
            }));
            const discount = await computeEffectiveDiscountPct(
              tx,
              ctx.organizationId,
              headerDisc,
              lines,
            );
            effectiveDiscountPct = discount.effectiveDiscountPct;
            const { config } = await ensureApprovalPolicy(tx, ctx.organizationId);
            const { requiresApproval, tier } = resolveApprovalRequirement(
              discount.effectiveDiscountPct,
              config,
            );

            const approved = await tx.salesQuoteApproval.findFirst({
              where: {
                organizationId: ctx.organizationId,
                quoteId: id,
                status: 'approved',
              },
              orderBy: { actionedAt: 'desc' },
            });

            if (requiresApproval && !approved) {
              let pending = await tx.salesQuoteApproval.findFirst({
                where: {
                  organizationId: ctx.organizationId,
                  quoteId: id,
                  status: 'pending',
                },
              });
              if (!pending) {
                pending = await tx.salesQuoteApproval.create({
                  data: {
                    organizationId: ctx.organizationId,
                    quoteId: id,
                    requestedById: ctx.staff.id,
                    status: 'pending',
                    effectiveDiscountPct: discount.effectiveDiscountPct,
                  },
                });
              } else {
                pending = await tx.salesQuoteApproval.update({
                  where: { id: pending.id },
                  data: { effectiveDiscountPct: discount.effectiveDiscountPct },
                });
              }

              await tx.salesQuote.update({
                where: { id },
                data: { ...data, status: 'pending_approval' },
              });
              await tx.auditEvent.create({
                data: {
                  organizationId: ctx.organizationId,
                  actorUserId: ctx.staff.id,
                  actorEmail: ctx.staff.email,
                  action: 'sales.quote.approval_requested',
                  entityType: 'SalesQuote',
                  entityId: id,
                  route: `/api/sales/quotes/${id}`,
                  metadata: {
                    effectiveDiscountPct: discount.effectiveDiscountPct,
                    tierApprover: tier?.approver ?? null,
                    approvalId: pending.id,
                    // TODO(Phase C): upgrade to team-leader resolution (deal owner's SalesTeam lead).
                    approverResolution: resolveQuoteApproverNote(),
                  },
                },
              });

              const updated = await tx.salesQuote.findFirst({
                where: { id },
                include: quoteInclude,
              });
              return {
                kind: 'approval_required' as const,
                quote: updated as QuoteWithRelations,
                effectiveDiscountPct: discount.effectiveDiscountPct,
                message: `Discount ${discount.effectiveDiscountPct}% exceeds policy — quote submitted for approval.`,
              };
            }
          }

          const allowed = STATUS_TRANSITIONS[existing.status] ?? [];
          if (!allowed.includes(nextStatus)) {
            return {
              kind: 'invalid_transition' as const,
              from: existing.status,
              to: nextStatus,
            };
          }

          data.status = nextStatus as Prisma.SalesQuoteUncheckedUpdateInput['status'];
          const now = new Date();
          if (nextStatus === 'sent' && !existing.sentAt) data.sentAt = now;
          if (nextStatus === 'accepted') {
            data.acceptedAt = now;
            if (!existing.sentAt) data.sentAt = now;
          }
          if (nextStatus === 'draft') data.acceptedAt = null;
        }

        const updated = await tx.salesQuote.update({
          where: { id },
          data,
          include: quoteInclude,
        });

        if (nextStatus === 'sent' && nextStatus !== existing.status) {
          await tx.auditEvent.create({
            data: {
              organizationId: ctx.organizationId,
              actorUserId: ctx.staff.id,
              actorEmail: ctx.staff.email,
              action: 'sales.quote.sent',
              entityType: 'SalesQuote',
              entityId: id,
              route: `/api/sales/quotes/${id}`,
              metadata: {
                fromStatus: existing.status,
                effectiveDiscountPct,
              },
            },
          });
        }

        return {
          kind: 'ok' as const,
          quote: updated as QuoteWithRelations,
          effectiveDiscountPct,
        };
      });

      if (result.kind === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (result.kind === 'read_only') {
        return NextResponse.json(
          { error: 'This quote version is superseded and read-only. Revise to edit.' },
          { status: 409 },
        );
      }
      if (result.kind === 'invalid_transition') {
        return NextResponse.json(
          { error: `Cannot move quote from ${result.from} to ${result.to}.` },
          { status: 400 },
        );
      }
      const includeCost = await canViewSalesMargin(ctx.staff);
      if (result.kind === 'approval_required') {
        return NextResponse.json(
          {
            quote: mapQuote(result.quote, { includeCost }),
            approvalRequired: true,
            effectiveDiscountPct: result.effectiveDiscountPct,
            error: result.message,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({
        quote: mapQuote(result.quote, { includeCost }),
        effectiveDiscountPct: result.effectiveDiscountPct,
      });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update quote.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const deleted = await ctx.run(async (tx) => {
        const existing = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return { kind: 'not_found' as const };
        if (existing.supersededById) return { kind: 'read_only' as const };
        await tx.salesQuote.delete({ where: { id } });
        return { kind: 'ok' as const };
      });
      if (deleted.kind === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (deleted.kind === 'read_only') {
        return NextResponse.json(
          { error: 'This quote version is superseded and read-only.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, id });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete quote.' }, { status: 500 });
    }
  });
}
