import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canViewSalaryFields, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string; departmentId: string }> };

function readStr(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === 'string' ? (v.trim() || null) : null;
}

function hasKey(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
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

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: clientId, departmentId: id } = await context.params;
  if (!clientId || !id) {
    return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });
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
        tx.department.findFirst({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          include: {
            head: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
          },
        }),
      );
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      const employees = await ctx.run((tx) =>
        tx.employee.findMany({
          where: { organizationId: ctx.organizationId, outsourcingClientId: clientId, departmentId: id },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
            baseSalary: true,
          },
        }),
      );

      const includeSalary = canViewSalaryFields(ctx.staff);
      const salaried = employees.filter((e) => e.baseSalary != null);
      const totalBaseSalary = salaried.reduce((sum, e) => sum + Number(e.baseSalary), 0);

      return NextResponse.json({
        id: department.id,
        name: department.name,
        code: department.code ?? null,
        description: department.description ?? null,
        headEmployeeId: department.headEmployeeId ?? null,
        head: department.head
          ? {
              id: department.head.id,
              name: `${department.head.firstName} ${department.head.lastName}`.trim(),
              jobTitle: department.head.jobTitle ?? null,
            }
          : null,
        costCenterCode: department.costCenterCode ?? null,
        costCenterName: department.costCenterName ?? null,
        isActive: department.isActive,
        employeeCount: employees.length,
        payroll: {
          canView: includeSalary,
          withSalary: salaried.length,
          totalBaseSalary: includeSalary ? totalBaseSalary : null,
          avgBaseSalary: includeSalary && salaried.length > 0 ? Math.round(totalBaseSalary / salaried.length) : null,
        },
        employees: employees.map((e) => ({
          id: e.id,
          employeeNumber: e.employeeNumber ?? null,
          name: `${e.firstName} ${e.lastName}`.trim(),
          jobTitle: e.jobTitle ?? null,
          employmentStatus: e.employmentStatus,
          baseSalary: includeSalary && e.baseSalary != null ? Number(e.baseSalary) : null,
        })),
      });
    } catch (e) {
      console.error('[departments detail GET]', e);
      return NextResponse.json({ error: 'Failed to load department' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: clientId, departmentId: id } = await context.params;
  if (!clientId || !id) {
    return NextResponse.json({ error: 'Client and department id required' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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

      const existing = await ctx.run((tx) =>
        tx.department.findFirst({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      const data: Prisma.DepartmentUpdateInput = {};

      if (hasKey(body, 'name')) {
        const name = readStr(body, 'name');
        if (!name) {
          return NextResponse.json({ error: 'Department name cannot be empty.' }, { status: 400 });
        }
        const dup = await ctx.run((tx) =>
          tx.department.findFirst({
            where: {
              organizationId: ctx.organizationId,
              outsourcingClientId: clientId,
              name: { equals: name, mode: 'insensitive' },
              NOT: { id },
            },
            select: { id: true },
          }),
        );
        if (dup) {
          return NextResponse.json(
            { error: `A department named "${name}" already exists for this client.` },
            { status: 409 },
          );
        }
        data.name = name;
      }

      if (hasKey(body, 'code')) {
        const code = readStr(body, 'code');
        if (code) {
          const dup = await ctx.run((tx) =>
            tx.department.findFirst({
              where: {
                organizationId: ctx.organizationId,
                outsourcingClientId: clientId,
                code: { equals: code, mode: 'insensitive' },
                NOT: { id },
              },
              select: { id: true },
            }),
          );
          if (dup) {
            return NextResponse.json(
              { error: `Department code "${code}" is already in use for this client.` },
              { status: 409 },
            );
          }
        }
        data.code = code;
      }

      if (hasKey(body, 'description')) data.description = readStr(body, 'description');
      if (hasKey(body, 'costCenterCode')) data.costCenterCode = readStr(body, 'costCenterCode');
      if (hasKey(body, 'costCenterName')) data.costCenterName = readStr(body, 'costCenterName');
      if (hasKey(body, 'isActive') && typeof body.isActive === 'boolean') data.isActive = body.isActive;

      if (hasKey(body, 'headEmployeeId')) {
        const headEmployeeId = readStr(body, 'headEmployeeId');
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
          data.head = { connect: { id: headEmployeeId } };
        } else {
          data.head = { disconnect: true };
        }
      }

      const updated = await ctx.run((tx) =>
        tx.department.update({
          where: { id },
          data,
          include: {
            _count: { select: { employees: true } },
            head: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      );

      await ctx.audit({
        action: 'department.updated',
        entityType: 'Department',
        entityId: id,
        route: 'PATCH /api/outsourcing/clients/[id]/departments/[departmentId]',
        metadata: { clientId, fields: Object.keys(data) },
      });

      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        code: updated.code ?? null,
        description: updated.description ?? null,
        headEmployeeId: updated.headEmployeeId ?? null,
        headName: updated.head ? `${updated.head.firstName} ${updated.head.lastName}`.trim() : null,
        costCenterCode: updated.costCenterCode ?? null,
        costCenterName: updated.costCenterName ?? null,
        isActive: updated.isActive,
        employeeCount: updated._count.employees,
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'A department with this name or code already exists for this client.' },
          { status: 409 },
        );
      }
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

      const target = await ctx.run((tx) =>
        tx.department.findFirst({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          include: { _count: { select: { employees: true } } },
        }),
      );
      if (!target) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }

      await ctx.run((tx) =>
        tx.department.deleteMany({
          where: { id, organizationId: ctx.organizationId, outsourcingClientId: clientId },
        }),
      );

      await ctx.audit({
        action: 'department.deleted',
        entityType: 'Department',
        entityId: id,
        route: 'DELETE /api/outsourcing/clients/[id]/departments/[departmentId]',
        metadata: { clientId, name: target.name, unassignedEmployees: target._count.employees },
      });

      return NextResponse.json({ ok: true, unassignedEmployees: target._count.employees });
    } catch (e) {
      console.error('[departments DELETE]', e);
      return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
    }
  });
}
