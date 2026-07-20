import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

type DepartmentWithMeta = Prisma.DepartmentGetPayload<{
  include: {
    _count: { select: { employees: true } };
    head: { select: { id: true; firstName: true; lastName: true } };
  };
}>;

function serializeDepartment(d: DepartmentWithMeta) {
  return {
    id: d.id,
    name: d.name,
    code: d.code ?? null,
    description: d.description ?? null,
    headEmployeeId: d.headEmployeeId ?? null,
    headName: d.head ? `${d.head.firstName} ${d.head.lastName}`.trim() : null,
    costCenterCode: d.costCenterCode ?? null,
    costCenterName: d.costCenterName ?? null,
    isActive: d.isActive,
    employeeCount: d._count.employees,
  };
}

const DEPARTMENT_INCLUDE = {
  _count: { select: { employees: true } },
  head: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.DepartmentInclude;

function readStr(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

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

      const client = await assertClientInOrg(clientId, ctx.organizationId, ctx.run);
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const departments = await ctx.run((tx) =>
        tx.department.findMany({
          where: { organizationId: ctx.organizationId, outsourcingClientId: clientId },
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
          include: DEPARTMENT_INCLUDE,
        }),
      );

      return NextResponse.json(departments.map(serializeDepartment));
    } catch (e) {
      console.error('[departments GET]', e);
      return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = readStr(body, 'name');
  if (!name) {
    return NextResponse.json({ error: 'Department name is required.' }, { status: 400 });
  }
  const code = readStr(body, 'code');
  const description = readStr(body, 'description');
  const headEmployeeId = readStr(body, 'headEmployeeId');
  const costCenterCode = readStr(body, 'costCenterCode');
  const costCenterName = readStr(body, 'costCenterName');

  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const client = await assertClientInOrg(clientId, ctx.organizationId, ctx.run);
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const dupName = await ctx.run((tx) =>
        tx.department.findFirst({
          where: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            name: { equals: name, mode: 'insensitive' },
          },
          select: { id: true },
        }),
      );
      if (dupName) {
        return NextResponse.json(
          { error: `A department named "${name}" already exists for this client.` },
          { status: 409 },
        );
      }

      if (code) {
        const dupCode = await ctx.run((tx) =>
          tx.department.findFirst({
            where: {
              organizationId: ctx.organizationId,
              outsourcingClientId: clientId,
              code: { equals: code, mode: 'insensitive' },
            },
            select: { id: true },
          }),
        );
        if (dupCode) {
          return NextResponse.json(
            { error: `Department code "${code}" is already in use for this client.` },
            { status: 409 },
          );
        }
      }

      if (headEmployeeId) {
        const head = await ctx.run((tx) =>
          tx.employee.findFirst({
            where: { id: headEmployeeId, organizationId: ctx.organizationId, outsourcingClientId: clientId },
            select: { id: true },
          }),
        );
        if (!head) {
          return NextResponse.json(
            { error: 'Selected department head is not an employee of this client.' },
            { status: 400 },
          );
        }
      }

      const department = await ctx.run((tx) =>
        tx.department.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            name,
            code: code ?? undefined,
            description: description ?? undefined,
            headEmployeeId: headEmployeeId ?? undefined,
            costCenterCode: costCenterCode ?? undefined,
            costCenterName: costCenterName ?? undefined,
          },
          include: DEPARTMENT_INCLUDE,
        }),
      );

      await ctx.audit({
        action: 'department.created',
        entityType: 'Department',
        entityId: department.id,
        route: 'POST /api/outsourcing/clients/[id]/departments',
        metadata: { clientId, name: department.name, code: department.code },
      });

      return NextResponse.json(serializeDepartment(department));
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'A department with this name or code already exists for this client.' },
          { status: 409 },
        );
      }
      console.error('[departments POST]', e);
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }
  });
}
