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
      const teams = await ctx.run((tx) =>
        tx.salesTeam.findMany({
          where: { organizationId: ctx.organizationId },
          include: {
            members: {
              include: { employee: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: { name: 'asc' },
        }),
      );
      return NextResponse.json({
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          members: t.members.map((m) => ({
            employeeId: m.employeeId,
            role: m.role,
            name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
          })),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/teams',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load teams.' }, { status: 500 });
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
    const members = Array.isArray(body.members) ? (body.members as Record<string, unknown>[]) : [];
    try {
      const team = await ctx.run(async (tx) => {
        const t = await tx.salesTeam.create({
          data: { organizationId: ctx.organizationId, name },
        });
        for (const m of members) {
          if (typeof m.employeeId !== 'string') continue;
          await tx.salesTeamMember.create({
            data: {
              organizationId: ctx.organizationId,
              teamId: t.id,
              employeeId: m.employeeId,
              role: typeof m.role === 'string' ? m.role : 'member',
            },
          });
        }
        return t;
      });
      return NextResponse.json({ team: { id: team.id, name: team.name } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/teams',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create team.' }, { status: 500 });
    }
  });
}
