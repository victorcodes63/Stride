import { NextRequest, NextResponse } from 'next/server';

import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { getPayrollDisbursementProvider } from '@/lib/payroll-disbursement/provider';
import { pollDisbursementBatch } from '@/lib/payroll-disbursement/service';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }

    const provider = getPayrollDisbursementProvider();
    const result = await ctx.run((tx) =>
      pollDisbursementBatch(tx, { organizationId: ctx.organizationId, batchId: id }, provider),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    await ctx.audit({
      action: 'payroll.disbursement.polled',
      entityType: 'PayrollDisbursementBatch',
      entityId: id,
      route: 'POST /api/outsourcing/payroll/disbursements/[id]/poll',
      metadata: { status: result.batch.status, totals: result.batch.totals },
    });

    return NextResponse.json({ batch: result.batch, providerMode: provider.mode });
  });
}
