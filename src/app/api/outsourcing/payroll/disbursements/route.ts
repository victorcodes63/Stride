import { NextRequest, NextResponse } from 'next/server';

import { requireRecentSensitiveAuth } from '@/lib/admin-security';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { getPayrollDisbursementProvider } from '@/lib/payroll-disbursement/provider';
import {
  createAndSubmitDisbursementBatch,
  listDisbursementBatches,
} from '@/lib/payroll-disbursement/service';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { prisma } from '@/lib/prisma';
import { withTenant } from '@/lib/tenant-api';

function parsePeriod(searchParams: URLSearchParams) {
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : NaN;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : NaN;
  if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
    return null;
  }
  return { month, year };
}

export async function GET(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }

      const period = parsePeriod(new URL(request.url).searchParams);
      if (!period) {
        return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
      }

      const clientId = await resolvePrimaryWorkspaceClientId(
        prisma,
        new URL(request.url).searchParams.get('clientId'),
        request,
        ctx.organizationId,
      );

      const provider = getPayrollDisbursementProvider();
      const batches = await ctx.run((tx) =>
        listDisbursementBatches(
          tx,
          {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            month: period.month,
            year: period.year,
          },
          provider.mode,
        ),
      );

      return NextResponse.json({
        batches,
        providerMode: provider.mode,
        month: period.month,
        year: period.year,
      });
    },
  );
}

export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      const reauthError = requireRecentSensitiveAuth(request, ctx.staff.id);
      if (reauthError) return reauthError;

      const body = (await request.json().catch(() => ({}))) as {
        month?: number;
        year?: number;
        clientId?: string;
      };
      const month = body.month ?? NaN;
      const year = body.year ?? NaN;
      if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
        return NextResponse.json({ error: 'Valid month and year are required' }, { status: 400 });
      }

      const clientId = await resolvePrimaryWorkspaceClientId(
        prisma,
        body.clientId,
        request,
        ctx.organizationId,
      );
      const provider = getPayrollDisbursementProvider();

      const result = await ctx.run((tx) =>
        createAndSubmitDisbursementBatch(tx, {
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
          month,
          year,
          initiatedByUserId: ctx.staff.id,
        }, provider),
      );

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }

      await ctx.audit({
        action: 'payroll.disbursement.submitted',
        entityType: 'PayrollDisbursementBatch',
        entityId: result.batch.id,
        route: 'POST /api/outsourcing/payroll/disbursements',
        metadata: {
          month,
          year,
          clientId,
          providerMode: provider.mode,
          totals: result.batch.totals,
        },
      });

      return NextResponse.json({ batch: result.batch, providerMode: provider.mode }, { status: 201 });
    },
  );
}
