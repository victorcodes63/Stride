import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { mapOutsourcingClientToJson } from '@/lib/outsourcing-client';
import { isValidSendingDomain, normalizeSenderLocalPart } from '@/lib/payslip-sender';
import {
  createSendingDomain,
  verifySendingDomain,
  getSendingDomain,
  deleteSendingDomain,
  type SendingDomainResult,
} from '@/lib/resend-domains';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

const detailInclude = {
  _count: { select: { employees: true, departments: true } },
  rateCards: {
    orderBy: { effectiveFrom: 'desc' as const },
    include: { lines: { orderBy: { sortOrder: 'asc' as const } } },
  },
};

async function loadClientForSender(
  clientId: string,
  organizationId: string,
  run: TenantContext['run'],
) {
  return run((tx) =>
    tx.outsourcingClient.findFirst({
      where: { id: clientId, organizationId },
      select: {
        id: true,
        payslipResendDomainId: true,
        payslipSenderDomain: true,
      },
    }),
  );
}

async function updateAndReturn(
  clientId: string,
  data: Prisma.OutsourcingClientUpdateInput,
  run: TenantContext['run'],
) {
  const client = await run((tx) =>
    tx.outsourcingClient.update({ where: { id: clientId }, data, include: detailInclude }),
  );
  return NextResponse.json(mapOutsourcingClientToJson(client));
}

function statusVerifiedAt(status: string): Date | null {
  return status === 'verified' ? new Date() : null;
}

function domainErrorResponse(result: Extract<SendingDomainResult, { ok: false }>) {
  const status = result.reason === 'not_configured' ? 503 : 502;
  return NextResponse.json({ error: result.error }, { status });
}

/** POST — register a new sending domain in Resend and store the DNS records to publish. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawDomain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  const localPart = normalizeSenderLocalPart(typeof body.localPart === 'string' ? body.localPart : undefined);
  if (!isValidSendingDomain(rawDomain)) {
    return NextResponse.json({ error: 'Enter a valid domain, e.g. payroll.company.co.ke' }, { status: 400 });
  }

  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payslip delivery settings are restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const existing = await loadClientForSender(id, ctx.organizationId, ctx.run);
    if (!existing) return forbiddenResponse('Client not found for this organization.');

    // Clean up a previously-registered domain so we never orphan entries in Resend.
    if (existing.payslipResendDomainId) {
      await deleteSendingDomain(existing.payslipResendDomainId);
    }

    const result = await createSendingDomain(rawDomain);
    if (!result.ok) return domainErrorResponse(result);

    await ctx.audit({
      action: 'payslip.domain.added',
      entityType: 'OutsourcingClient',
      entityId: id,
      route: 'POST /api/outsourcing/clients/[id]/payslip-domain',
      metadata: { domain: result.name, status: result.status },
    });

    return updateAndReturn(
      id,
      {
        payslipResendDomainId: result.id,
        payslipSenderDomain: result.name,
        payslipSenderLocalPart: localPart,
        payslipSenderMode: 'custom_domain',
        payslipDomainStatus: result.status,
        payslipDomainRecords: result.records as unknown as Prisma.InputJsonValue,
        payslipDomainVerifiedAt: statusVerifiedAt(result.status),
      },
      ctx.run,
    );
  });
}

/** PATCH — trigger DNS re-verification and refresh the cached status + records. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payslip delivery settings are restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const existing = await loadClientForSender(id, ctx.organizationId, ctx.run);
    if (!existing) return forbiddenResponse('Client not found for this organization.');
    if (!existing.payslipResendDomainId) {
      return NextResponse.json({ error: 'No sending domain to verify. Add one first.' }, { status: 400 });
    }

    const result = await verifySendingDomain(existing.payslipResendDomainId);
    if (!result.ok) return domainErrorResponse(result);

    await ctx.audit({
      action: 'payslip.domain.verified',
      entityType: 'OutsourcingClient',
      entityId: id,
      route: 'PATCH /api/outsourcing/clients/[id]/payslip-domain',
      metadata: { domain: result.name, status: result.status },
    });

    return updateAndReturn(
      id,
      {
        payslipSenderDomain: result.name,
        payslipDomainStatus: result.status,
        payslipDomainRecords: result.records as unknown as Prisma.InputJsonValue,
        payslipDomainVerifiedAt: statusVerifiedAt(result.status),
      },
      ctx.run,
    );
  });
}

/** GET — refresh the domain status from Resend without triggering a new verification. */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payslip delivery settings are restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const existing = await loadClientForSender(id, ctx.organizationId, ctx.run);
    if (!existing) return forbiddenResponse('Client not found for this organization.');

    if (!existing.payslipResendDomainId) {
      const client = await ctx.run((tx) =>
        tx.outsourcingClient.findFirst({ where: { id, organizationId: ctx.organizationId }, include: detailInclude }),
      );
      if (!client) return forbiddenResponse('Client not found for this organization.');
      return NextResponse.json(mapOutsourcingClientToJson(client));
    }

    const result = await getSendingDomain(existing.payslipResendDomainId);
    if (!result.ok) return domainErrorResponse(result);

    return updateAndReturn(
      id,
      {
        payslipSenderDomain: result.name,
        payslipDomainStatus: result.status,
        payslipDomainRecords: result.records as unknown as Prisma.InputJsonValue,
        payslipDomainVerifiedAt: statusVerifiedAt(result.status),
      },
      ctx.run,
    );
  });
}

/** DELETE — remove the sending domain and revert to platform sending (Option B). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payslip delivery settings are restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const existing = await loadClientForSender(id, ctx.organizationId, ctx.run);
    if (!existing) return forbiddenResponse('Client not found for this organization.');

    if (existing.payslipResendDomainId) {
      await deleteSendingDomain(existing.payslipResendDomainId);
    }

    await ctx.audit({
      action: 'payslip.domain.removed',
      entityType: 'OutsourcingClient',
      entityId: id,
      route: 'DELETE /api/outsourcing/clients/[id]/payslip-domain',
      metadata: { domain: existing.payslipSenderDomain ?? null },
    });

    return updateAndReturn(
      id,
      {
        payslipResendDomainId: null,
        payslipSenderDomain: null,
        payslipSenderMode: 'platform',
        payslipDomainStatus: null,
        payslipDomainRecords: Prisma.DbNull,
        payslipDomainVerifiedAt: null,
      },
      ctx.run,
    );
  });
}
