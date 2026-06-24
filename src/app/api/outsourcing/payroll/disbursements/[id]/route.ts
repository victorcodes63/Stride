import { NextRequest, NextResponse } from 'next/server';

import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { getPayrollDisbursementProvider } from '@/lib/payroll-disbursement/provider';
import { getDisbursementBatch } from '@/lib/payroll-disbursement/service';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }

    const provider = getPayrollDisbursementProvider();
    const batch = await ctx.run((tx) =>
      getDisbursementBatch(tx, { organizationId: ctx.organizationId, batchId: id }, provider.mode),
    );

    if (!batch) {
      return NextResponse.json({ error: 'Disbursement batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch, providerMode: provider.mode });
  });
}
