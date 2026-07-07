import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string; departmentId: string }> };

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: clientId, departmentId: id } = await context.params;
  if (!clientId || !id) {
    return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name =
    typeof (body as { name?: string }).name === 'string'
      ? (body as { name: string }).name.trim()
      : '';
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
        tx.department.updateMany({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          data: { name },
        }),
      );
      if (department.count === 0) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      const updated = await ctx.run((tx) =>
        tx.department.findFirst({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          include: { _count: { select: { employees: true } } },
        }),
      );
      if (!updated) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        employeeCount: updated._count.employees,
      });
    } catch (e) {
      console.error('[departments PATCH]', e);
      return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
    }
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: clientId, departmentId: id } = await context.params;
  if (!clientId || !id) {
    return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });
  }

  return withTenant(_request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const client = await assertClientInOrg(clientId, ctx.organizationId, ctx.run);
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const result = await ctx.run((tx) =>
        tx.department.deleteMany({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
        }),
      );
      if (result.count === 0) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[departments DELETE]', e);
      return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
    }
  });
}
