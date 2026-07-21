import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { hasSalesQuoteApproveAccess } from '@/lib/sales/access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/sales/quotes/[id]/approval — approve or reject a pending quote (B2).
 * Body: { decision: "approved" | "rejected", reason: string } — reason required.
 *
 * TODO(Phase C): restrict action to the deal owner's team leader.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    if (!(await hasSalesQuoteApproveAccess(ctx.staff))) {
      return NextResponse.json({ error: 'Missing permission: sales.approve_quotes' }, { status: 403 });
    }

    const { id: quoteId } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const decision = typeof body.decision === 'string' ? body.decision.trim() : '';
    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json(
        { error: 'decision must be "approved" or "rejected".' },
        { status: 400 },
      );
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
    }

    try {
      const result = await ctx.run(async (tx) => {
        const quote = await tx.salesQuote.findFirst({
          where: { id: quoteId, organizationId: ctx.organizationId },
        });
        if (!quote) return { kind: 'not_found' as const };

        const pending = await tx.salesQuoteApproval.findFirst({
          where: {
            organizationId: ctx.organizationId,
            quoteId,
            status: 'pending',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!pending) {
          return { kind: 'no_pending' as const };
        }

        const now = new Date();
        const approval = await tx.salesQuoteApproval.update({
          where: { id: pending.id },
          data: {
            status: decision,
            reason,
            approverId: ctx.staff.id,
            actionedAt: now,
          },
        });

        // Reject returns quote to draft; approve leaves pending_approval so send can proceed.
        if (decision === 'rejected') {
          await tx.salesQuote.update({
            where: { id: quoteId },
            data: { status: 'draft' },
          });
        }

        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId,
            actorUserId: ctx.staff.id,
            actorEmail: ctx.staff.email,
            action:
              decision === 'approved'
                ? 'sales.quote.approval_approved'
                : 'sales.quote.approval_rejected',
            entityType: 'SalesQuote',
            entityId: quoteId,
            route: `/api/sales/quotes/${quoteId}/approval`,
            metadata: {
              approvalId: approval.id,
              reason,
              effectiveDiscountPct:
                approval.effectiveDiscountPct != null
                  ? Number(approval.effectiveDiscountPct)
                  : null,
              // TODO(Phase C): upgrade to team-leader resolution (deal owner's SalesTeam lead).
            },
          },
        });

        return {
          kind: 'ok' as const,
          approval: {
            id: approval.id,
            status: approval.status,
            reason: approval.reason,
            actionedAt: approval.actionedAt?.toISOString() ?? null,
            effectiveDiscountPct:
              approval.effectiveDiscountPct != null
                ? Number(approval.effectiveDiscountPct)
                : null,
          },
          quoteStatus: decision === 'rejected' ? 'draft' : quote.status,
        };
      });

      if (result.kind === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (result.kind === 'no_pending') {
        return NextResponse.json(
          { error: 'No pending approval for this quote.' },
          { status: 404 },
        );
      }
      return NextResponse.json({
        approval: result.approval,
        quoteStatus: result.quoteStatus,
      });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/quotes/[id]/approval',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to action approval.' }, { status: 500 });
    }
  });
}
