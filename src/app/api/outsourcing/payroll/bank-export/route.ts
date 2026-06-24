import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { buildBankExportCsv, formatBankExportPaymentReference } from '@/lib/payroll-bank-export';
import { requireRecentSensitiveAuth } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const reauthError = requireRecentSensitiveAuth(request, user.id);
    if (reauthError) return reauthError;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : NaN;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : NaN;
    const requestedClientId = searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = searchParams.get('departmentId') || undefined;

    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        month,
        year,
        employee: {
          outsourcingClientId: clientId,
          ...(departmentId ? { departmentId } : {}),
        },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            bankName: true,
            bankBranch: true,
            bankAccountNumber: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    });

    if (payrolls.length === 0) {
      return NextResponse.json({ error: 'No payroll records for this period and scope.' }, { status: 404 });
    }

    const blocked = payrolls.filter((p) => p.status === 'draft');
    if (blocked.length > 0) {
      return NextResponse.json(
        {
          error: 'All payroll records must be approved or paid before bank export.',
          draftCount: blocked.length,
        },
        { status: 409 },
      );
    }

    const rows = payrolls.map((p) => ({
      employeeNumber: p.employee.employeeNumber,
      firstName: p.employee.firstName,
      lastName: p.employee.lastName,
      bankName: p.employee.bankName,
      bankBranch: p.employee.bankBranch,
      bankAccountNumber: p.employee.bankAccountNumber,
      netPay: Number(p.netPay),
    }));

    const { csv, missingBankDetailsCount } = buildBankExportCsv({ month, year }, rows);
    const periodSlug = formatBankExportPaymentReference(month, year).replace(/^SAL-/, '');
    const filename = `payroll-${periodSlug}-bank-export.csv`;
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'payroll.bank_export.generated',
      entityType: 'PayrollBatch',
      entityId: `${clientId}:${year}-${String(month).padStart(2, '0')}`,
      route: 'GET /api/outsourcing/payroll/bank-export',
      metadata: { month, year, clientId, count: payrolls.length, missingBankDetailsCount },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Missing-Bank-Details-Count': String(missingBankDetailsCount),
      },
    });
  } catch (e) {
    console.error('[payroll bank-export]', e);
    return NextResponse.json({ error: 'Failed to build bank export' }, { status: 500 });
  }
}
