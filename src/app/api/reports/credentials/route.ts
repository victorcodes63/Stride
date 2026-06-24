import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseFormat, requireReportsUser, ymd } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

type DetailStatus = 'valid' | 'expiring' | 'expired';

function toDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const format = parseFormat(request);
  const now = toDayStart(new Date());
  const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const credentials = await prisma.employeeCredential.findMany({
    where: { employee: { outsourcingClientId: workspaceClientId } },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
  });

  let valid = 0;
  let expiringIn30Days = 0;
  let expiringIn90Days = 0;
  let expired = 0;

  const details = credentials.map((row) => {
    const employeeName = `${row.employee.firstName} ${row.employee.lastName}`.trim();
    const department = row.employee.department?.name ?? 'Unassigned';
    const expiryDate = row.expiryDate ? toDayStart(row.expiryDate) : null;
    const daysUntilExpiry = expiryDate
      ? Math.floor((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : Number.MAX_SAFE_INTEGER;
    let status: DetailStatus = 'valid';
    if (expiryDate && expiryDate < now) status = 'expired';
    else if (expiryDate && expiryDate <= day90) status = 'expiring';

    if (status === 'expired') expired += 1;
    else if (status === 'expiring' && expiryDate && expiryDate <= day30) expiringIn30Days += 1;
    else if (status === 'expiring') expiringIn90Days += 1;
    else valid += 1;

    return {
      employeeName,
      department,
      credentialType: row.credentialName,
      issuingBody: row.issuingAuthority ?? 'N/A',
      expiryDate: expiryDate ? ymd(expiryDate) : '',
      status,
      daysUntilExpiry: daysUntilExpiry === Number.MAX_SAFE_INTEGER ? 99999 : daysUntilExpiry,
    };
  });

  const report = {
    totalCredentials: credentials.length,
    valid,
    expiringIn30Days,
    expiringIn90Days,
    expired,
    details,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Employee', 'Department', 'Credential', 'Issuing Body', 'Expiry Date', 'Status', 'Days Until Expiry'],
      report.details.map((row) => [
        row.employeeName,
        row.department,
        row.credentialType,
        row.issuingBody,
        row.expiryDate,
        row.status,
        row.daysUntilExpiry,
      ])
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `credentials-${ymd(now)}.csv`),
    });
  }

  return jsonOrPdf(
    format,
    report,
    'Credential Status Report',
    `credentials-${ymd(now)}.pdf`,
    [
      `Generated: ${ymd(now)}`,
      `Total credentials: ${report.totalCredentials}`,
      `Valid: ${report.valid}`,
      `Expiring in 30 days: ${report.expiringIn30Days}`,
      `Expiring in 90 days: ${report.expiringIn90Days}`,
      `Expired: ${report.expired}`,
    ]
  );
}
