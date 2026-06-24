import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensurePermissionCatalog } from '@/lib/admin-permissions';
import { requireAdminActor } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
import type { UserRole } from '@/types/dashboard';

const ROLES: UserRole[] = ['admin', 'staff', 'viewer'];

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json([]);
    await ensurePermissionCatalog();
    const defs = await prisma.permissionDefinition.findMany({
      orderBy: [{ module: 'asc' }, { label: 'asc' }],
      include: { rolePermissions: true },
    });

    const rows = defs.map((d) => {
      const roleMap = new Map(d.rolePermissions.map((rp) => [rp.role, rp.isAllowed]));
      return {
        permissionKey: d.key,
        label: d.label,
        module: d.module,
        description: d.description,
        adminAllowed: roleMap.get('admin') ?? false,
        staffAllowed: roleMap.get('staff') ?? false,
        viewerAllowed: roleMap.get('viewer') ?? false,
      };
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/admin/roles-permissions error:', e);
    return NextResponse.json({ error: 'Failed to load role permissions.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const rows = Array.isArray(body) ? (body as Record<string, unknown>[]) : null;
  if (!rows) return NextResponse.json({ error: 'Body must be an array.' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    await ensurePermissionCatalog();

    const defs = await prisma.permissionDefinition.findMany({ select: { id: true, key: true } });
    const keyToId = new Map(defs.map((d) => [d.key, d.id]));

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const permissionKey = typeof row.permissionKey === 'string' ? row.permissionKey : '';
        const permissionId = keyToId.get(permissionKey);
        if (!permissionId) continue;

        for (const role of ROLES) {
          const raw = row[`${role}Allowed`];
          if (typeof raw !== 'boolean') continue;
          await tx.rolePermission.upsert({
            where: { role_permissionId: { role, permissionId } },
            update: { isAllowed: raw },
            create: { role, permissionId, isAllowed: raw },
          });
        }
      }
    });

    await logAuditEvent({
      actor,
      action: 'role_permissions.updated',
      entityType: 'RolePermission',
      route: '/api/admin/roles-permissions',
      metadata: { rowCount: rows.length },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PUT /api/admin/roles-permissions error:', e);
    return NextResponse.json({ error: 'Failed to save role permissions.' }, { status: 500 });
  }
}
