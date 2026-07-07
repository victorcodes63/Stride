import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { canConvertHire } from '@/lib/ats-governance';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { assessMpesaProductionReadiness } from '@/lib/payroll-disbursement/mpesa-production-readiness';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mpesa-readiness — RAV-177 production checklist for admins. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canConvertHire(ctx.staff) && ctx.staff.role !== 'admin') {
      return forbiddenResponse();
    }
    return NextResponse.json(assessMpesaProductionReadiness());
  });
}
