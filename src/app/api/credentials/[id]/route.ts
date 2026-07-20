import { NextRequest, NextResponse } from 'next/server';
import { CredentialCategory, CredentialStatus } from '@prisma/client';
import { canAccessCredentials, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import {
  CATEGORIES,
  STATUSES,
  asDate,
  asOptionalString,
  credentialInclude,
  toResponse,
} from '../_shared';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(_request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;
    const record = await ctx.run((tx) =>
      tx.employeeCredential.findFirst({
        where: ctx.where({ id }),
        include: credentialInclude,
      }),
    );
    if (!record) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    await ctx.audit({
      action: ctx.staff.role === 'admin' ? 'credential.viewed' : 'credential.viewed_non_admin',
      entityType: 'EmployeeCredential',
      entityId: record.id,
      route: 'GET /api/credentials/[id]',
      metadata: { employeeId: record.employeeId, category: record.category, status: record.status },
    });
    return NextResponse.json(toResponse(record));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.credentialName !== undefined) {
      const name = asOptionalString(body.credentialName);
      if (!name) return NextResponse.json({ error: 'credentialName cannot be empty' }, { status: 400 });
      data.credentialName = name;
    }
    if (body.category !== undefined) {
      const category = asOptionalString(body.category);
      if (!category || !CATEGORIES.has(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      data.category = category as CredentialCategory;
    }
    if (body.status !== undefined) {
      const status = asOptionalString(body.status);
      if (!status || !STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = status as CredentialStatus;
    }
    if (body.employeeId !== undefined) {
      const employeeId = asOptionalString(body.employeeId);
      if (!employeeId) return NextResponse.json({ error: 'employeeId cannot be empty' }, { status: 400 });
      const employee = await ctx.run((tx) =>
        tx.employee.findFirst({ where: ctx.where({ id: employeeId }), select: { id: true } }),
      );
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      data.employeeId = employeeId;
    }
    if (body.reminderDays !== undefined) {
      const reminder = Number(body.reminderDays);
      if (!Number.isFinite(reminder) || reminder < 0 || reminder > 365) {
        return NextResponse.json({ error: 'reminderDays must be between 0 and 365' }, { status: 400 });
      }
      data.reminderDays = Math.floor(reminder);
    }

    if (body.credentialNumber !== undefined) data.credentialNumber = asOptionalString(body.credentialNumber);
    if (body.issuingAuthority !== undefined) data.issuingAuthority = asOptionalString(body.issuingAuthority);
    if (body.scopeOfPractice !== undefined) data.scopeOfPractice = asOptionalString(body.scopeOfPractice);
    if (body.notes !== undefined) data.notes = asOptionalString(body.notes);
    if (body.documentPath !== undefined) data.documentPath = asOptionalString(body.documentPath);
    if (body.issueDate !== undefined) data.issueDate = asDate(body.issueDate);
    if (body.expiryDate !== undefined) data.expiryDate = asDate(body.expiryDate);

    // Verification: `verify: true` stamps the current time, `verify: false`
    // clears it; an explicit `verifiedAt` string is honoured otherwise.
    let verified = false;
    if (body.verify !== undefined) {
      data.verifiedAt = body.verify ? new Date() : null;
      verified = body.verify === true;
    } else if (body.verifiedAt !== undefined) {
      data.verifiedAt = asDate(body.verifiedAt);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields supplied to update' }, { status: 400 });
    }

    try {
      const updated = await ctx.run((tx) =>
        tx.employeeCredential.update({
          where: { id },
          data,
          include: credentialInclude,
        }),
      );
      await ctx.audit({
        action: verified ? 'credential.verified' : 'credential.updated',
        entityType: 'EmployeeCredential',
        entityId: updated.id,
        route: 'PATCH /api/credentials/[id]',
        metadata: { changedFields: Object.keys(data), employeeId: updated.employeeId },
      });
      return NextResponse.json(toResponse(updated));
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'P2025') return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
      return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
    }
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(_request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.employeeCredential.findFirst({
          where: ctx.where({ id }),
          select: { id: true, employeeId: true, category: true },
        }),
      );
      await ctx.run((tx) => tx.employeeCredential.delete({ where: { id } }));
      await ctx.audit({
        action: 'credential.deleted',
        entityType: 'EmployeeCredential',
        entityId: id,
        route: 'DELETE /api/credentials/[id]',
        metadata: {
          employeeId: existing?.employeeId ?? null,
          category: existing?.category ?? null,
        },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'P2025') return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
      return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
    }
  });
}
