import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { buildOutsourcedLeaveReport, personToDetail } from '@/lib/leave/leave-report-builders';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET ?employeeId=&year=&clientId= — full leave detail for one outsourced employee. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);
    const employeeId = sp.get('employeeId')?.trim();
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

    const dataset = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(tx, sp.get('clientId'), request, ctx.organizationId);
      return buildOutsourcedLeaveReport(tx, { organizationId: ctx.organizationId, clientId, year });
    });

    const person = dataset.people.find((p) => p.id === employeeId);
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(personToDetail(person, dataset));
  });
}
