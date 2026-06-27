import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { listFleetArAgeing } from '@/lib/fleet-billing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const rows = await listFleetArAgeing(
      prisma,
      ctx.organizationId,
      ctx.workspaceClientId,
    );

    const summary = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
      totalOutstanding: 0,
    };

    for (const row of rows) {
      summary[row.bucket] += row.amountIncVat;
      summary.totalOutstanding += row.amountIncVat;
    }

    return NextResponse.json({ summary, rows });
  });
}
