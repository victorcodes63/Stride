import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

async function assertClientInOrg(
  clientId: string,
  organizationId: string,
  run: TenantContext['run'],
) {
  return run((tx) =>
    tx.outsourcingClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    }),
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(_request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json([], { status: 200 });
      }

      const client = await ctx.run((tx) =>
        tx.outsourcingClient.findFirst({
          where: { id: clientId, organizationId: ctx.organizationId },
          select: { id: true },
        }),
      );
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const departments = await ctx.run((tx) =>
        tx.department.findMany({
          where: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
          },
          orderBy: { name: 'asc' },
          include: { _count: { select: { employees: true } } },
        }),
      );

      return NextResponse.json(
        departments.map((d) => ({
          id: d.id,
          name: d.name,
          employeeCount: d._count.employees,
        })),
      );
    } catch (e) {
      console.error('[departments GET]', e);
      return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name =
    typeof (body as { name?: string }).name === 'string' ? (body as { name: string }).name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Department name is required.' }, { status: 400 });
  }

  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const client = await assertClientInOrg(clientId, ctx.organizationId, ctx.run);
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const department = await ctx.run((tx) =>
        tx.department.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            name,
          },
          include: { _count: { select: { employees: true } } },
        }),
      );

      return NextResponse.json({
        id: department.id,
        name: department.name,
        employeeCount: department._count.employees,
      });
    } catch (e) {
      console.error('[departments POST]', e);
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }
  });
}
