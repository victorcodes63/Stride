import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    try {
      const loads = await ctx.run((tx) =>
        tx.salesVanLoad.findMany({
          where: { organizationId: ctx.organizationId },
          include: {
            facilitySite: { select: { name: true } },
            _count: { select: { lines: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      );
      return NextResponse.json({
        vanLoads: loads.map((l) => ({
          id: l.id,
          status: l.status,
          facilitySiteName: l.facilitySite.name,
          lineCount: l._count.lines,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/van-loads',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load van loads.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const facilitySiteId = typeof body.facilitySiteId === 'string' ? body.facilitySiteId : '';
    const lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
    if (!facilitySiteId || lines.length === 0) {
      return NextResponse.json({ error: 'facilitySiteId and lines required.' }, { status: 400 });
    }
    try {
      const load = await ctx.run((tx) =>
        tx.salesVanLoad.create({
          data: {
            organizationId: ctx.organizationId,
            facilitySiteId,
            vehicleId: typeof body.vehicleId === 'string' ? body.vehicleId : null,
            employeeId: typeof body.employeeId === 'string' ? body.employeeId : null,
            status: 'draft',
            notes: typeof body.notes === 'string' ? body.notes : null,
            lines: {
              create: lines.map((l) => ({
                organizationId: ctx.organizationId,
                productId: String(l.productId),
                qtyBase: new Prisma.Decimal(Number(l.qtyBase) || 0),
              })),
            },
          },
        }),
      );
      return NextResponse.json({ vanLoad: { id: load.id, status: load.status } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/van-loads',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create van load.' }, { status: 500 });
    }
  });
}
