import { NextRequest, NextResponse } from 'next/server';
import { CredentialCategory, CredentialStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessCredentials, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import {
  CATEGORIES,
  STATUSES,
  asDate,
  asOptionalString,
  credentialInclude,
  loadCredentials,
  parseCredentialQuery,
  toResponse,
} from './_shared';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ credentials: [], total: 0, page: 1, pageSize: 25 }, { status: 200 });
    }

    const query = parseCredentialQuery(request);
    const all = await loadCredentials(ctx, request, query);

    const sp = request.nextUrl.searchParams;
    const pageSizeRaw = Number(sp.get('pageSize'));
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(100, Math.floor(pageSizeRaw)) : 25;
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageRaw = Number(sp.get('page'));
    const page =
      Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(Math.floor(pageRaw), totalPages) : 1;
    const start = (page - 1) * pageSize;
    const credentials = all.slice(start, start + pageSize);

    await ctx.audit({
      action: 'credential.records.view',
      entityType: 'EmployeeCredential',
      route: 'GET /api/credentials',
      metadata: {
        employeeId: query.employeeId ?? null,
        category: query.category ?? null,
        status: query.status ?? null,
        expiring: query.expiringOnly,
        q: query.q,
        sort: query.sort,
        dir: query.dir,
        page,
        pageSize,
        total,
      },
    });

    return NextResponse.json({ credentials, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const employeeId = asOptionalString(body.employeeId);
    const credentialName = asOptionalString(body.credentialName);
    const categoryRaw = asOptionalString(body.category);
    const statusRaw = asOptionalString(body.status);

    if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    if (!credentialName) {
      return NextResponse.json({ error: 'credentialName is required' }, { status: 400 });
    }

    const category =
      categoryRaw && CATEGORIES.has(categoryRaw) ? (categoryRaw as CredentialCategory) : 'medical_license';
    const status =
      statusRaw && STATUSES.has(statusRaw) ? (statusRaw as CredentialStatus) : 'active';

    const reminderDaysRaw = Number(body.reminderDays);
    const reminderDays =
      Number.isFinite(reminderDaysRaw) && reminderDaysRaw >= 0 && reminderDaysRaw <= 365
        ? Math.floor(reminderDaysRaw)
        : 30;

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const employee = await ctx.run((tx) =>
      tx.employee.findFirst({
        where: ctx.where({ id: employeeId, outsourcingClientId: workspaceClientId }),
        select: { id: true, outsourcingClientId: true },
      }),
    );
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const created = await ctx.run((tx) =>
      tx.employeeCredential.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId,
          category,
          credentialName,
          credentialNumber: asOptionalString(body.credentialNumber) ?? undefined,
          issuingAuthority: asOptionalString(body.issuingAuthority) ?? undefined,
          issueDate: asDate(body.issueDate) ?? undefined,
          expiryDate: asDate(body.expiryDate) ?? undefined,
          reminderDays,
          status,
          scopeOfPractice: asOptionalString(body.scopeOfPractice) ?? undefined,
          notes: asOptionalString(body.notes) ?? undefined,
          documentPath: asOptionalString(body.documentPath) ?? undefined,
          verifiedAt: asDate(body.verifiedAt) ?? undefined,
        },
        include: credentialInclude,
      }),
    );

    await ctx.audit({
      action: 'credential.created',
      entityType: 'EmployeeCredential',
      entityId: created.id,
      route: 'POST /api/credentials',
      metadata: { employeeId: created.employeeId, category: created.category, status: created.status },
    });

    return NextResponse.json(toResponse(created), { status: 201 });
  });
}
