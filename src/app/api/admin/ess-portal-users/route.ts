import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';

const ROUNDS = 10;
const ESS_ROLES = ['employee', 'manager', 'hr'] as const;

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json([]);
    const users = await prisma.essPortalUser.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        createdByUser: { select: { name: true } },
      },
    });
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        employeeId: u.employeeId,
        employeeName: u.employee ? `${u.employee.firstName} ${u.employee.lastName}`.trim() : null,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        mustResetPassword: u.mustResetPassword,
        notes: u.notes,
        createdByName: u.createdByUser?.name ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error('GET /api/admin/ess-portal-users error:', e);
    return NextResponse.json({ error: 'Failed to load ESS users.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const role = typeof b.role === 'string' ? b.role : 'employee';
  const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;
  const employeeId = typeof b.employeeId === 'string' && b.employeeId.trim() ? b.employeeId.trim() : null;
  const mustResetPassword = typeof b.mustResetPassword === 'boolean' ? b.mustResetPassword : true;

  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }
  if (!ESS_ROLES.includes(role as (typeof ESS_ROLES)[number])) {
    return NextResponse.json({ error: 'Invalid ESS role.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    const existing = await prisma.essPortalUser.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'ESS user with this email already exists.' }, { status: 409 });

    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      });
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found for ESS account.' }, { status: 404 });
      }
    }

    const user = await prisma.essPortalUser.create({
      data: {
        email,
        name,
        role: role as 'employee' | 'manager' | 'hr',
        employeeId,
        notes,
        mustResetPassword,
        passwordHash: await bcrypt.hash(password, ROUNDS),
        createdByUserId: actor?.userId ?? null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        createdByUser: { select: { name: true } },
      },
    });

    await logAuditEvent({
      actor,
      action: 'ess_user.created',
      entityType: 'EssPortalUser',
      entityId: user.id,
      route: '/api/admin/ess-portal-users',
      metadata: { email: user.email, role: user.role },
    });

    return NextResponse.json({
      id: user.id,
      employeeId: user.employeeId,
      employeeName: user.employee ? `${user.employee.firstName} ${user.employee.lastName}`.trim() : null,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      mustResetPassword: user.mustResetPassword,
      notes: user.notes,
      createdByName: user.createdByUser?.name ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /api/admin/ess-portal-users error:', e);
    return NextResponse.json({ error: 'Failed to create ESS user.' }, { status: 500 });
  }
}
