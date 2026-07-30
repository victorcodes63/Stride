import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    try {
      const territories = await ctx.run((tx) =>
        tx.salesTerritory.findMany({
          where: { organizationId: ctx.organizationId },
          include: {
            members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
            beats: { include: { outlets: true } },
          },
          orderBy: { name: 'asc' },
        }),
      );
      return NextResponse.json({
        territories: territories.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          members: t.members.map((m) => ({
            employeeId: m.employeeId,
            name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
          })),
          beats: t.beats.map((b) => ({
            id: b.id,
            name: b.name,
            weekday: b.weekday,
            outletCount: b.outlets.length,
          })),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/territories',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load territories.' }, { status: 500 });
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required.' }, { status: 400 });
    try {
      const territory = await ctx.run(async (tx) => {
        const t = await tx.salesTerritory.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            code: typeof body.code === 'string' ? body.code : null,
          },
        });
        const memberIds = Array.isArray(body.memberEmployeeIds)
          ? (body.memberEmployeeIds as string[])
          : [];
        for (const employeeId of memberIds) {
          await tx.salesTerritoryMember.create({
            data: { organizationId: ctx.organizationId, territoryId: t.id, employeeId },
          });
        }
        const beats = Array.isArray(body.beats) ? (body.beats as Record<string, unknown>[]) : [];
        for (const beat of beats) {
          const b = await tx.salesBeat.create({
            data: {
              organizationId: ctx.organizationId,
              territoryId: t.id,
              name: String(beat.name || 'Beat'),
              weekday: Number(beat.weekday) || 1,
            },
          });
          const outlets = Array.isArray(beat.outletClientIds) ? (beat.outletClientIds as string[]) : [];
          for (let i = 0; i < outlets.length; i++) {
            await tx.salesBeatOutlet.create({
              data: {
                organizationId: ctx.organizationId,
                beatId: b.id,
                accountsClientId: outlets[i]!,
                sortOrder: i,
              },
            });
          }
        }
        return t;
      });
      return NextResponse.json({ territory: { id: territory.id, name: territory.name } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/territories',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create territory.' }, { status: 500 });
    }
  });
}
