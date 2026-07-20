import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeIncident } from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  { header: 'Ref #', width: 16 },
  { header: 'Title', width: 32 },
  { header: 'Type', width: 18 },
  { header: 'Severity', width: 12 },
  { header: 'Status', width: 16 },
  { header: 'Site', width: 20 },
  { header: 'Location', width: 20 },
  { header: 'Occurred at', width: 20 },
  { header: 'Reported by', width: 22 },
  { header: 'Root cause category', width: 20 },
  { header: 'Root cause', width: 40 },
  { header: 'Witnesses', width: 24 },
  { header: 'Reportable', width: 12 },
  { header: 'Lost-time injury', width: 14 },
  { header: 'Lost-time days', width: 14 },
  { header: 'Open actions', width: 12 },
  { header: 'Resolved at', width: 20 },
  { header: 'Closed at', width: 20 },
];

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') : '';
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const format = sp.get('format')?.trim() === 'csv' ? 'csv' : 'xlsx';
    const status = sp.get('status')?.trim() || undefined;
    const siteName = sp.get('siteName')?.trim() || undefined;
    const q = sp.get('q')?.trim() || undefined;

    try {
      const incidents = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const where: Prisma.HseIncidentWhereInput = {
          ...ctx.where(),
          outsourcingClientId: clientId,
          ...(status ? { status: status as never } : {}),
          ...(siteName ? { siteName } : {}),
          ...(q
            ? {
                OR: [
                  { incidentNumber: { contains: q, mode: 'insensitive' } },
                  { title: { contains: q, mode: 'insensitive' } },
                  { siteName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        };

        return tx.hseIncident.findMany({
          where,
          include: {
            reportedByUser: { select: { name: true } },
            reportedByEmployee: { select: { firstName: true, lastName: true } },
            actions: { select: { id: true, status: true } },
          },
          orderBy: [{ occurredAt: 'desc' }],
          take: 5000,
        });
      });

      const rows = incidents.map(serializeIncident);
      const stamp = new Date().toISOString().slice(0, 10);

      const rowValues = (r: (typeof rows)[number]) => [
        r.incidentNumber,
        r.title,
        r.incidentTypeLabel,
        r.severityLabel,
        r.statusLabel,
        r.siteName ?? '',
        r.location ?? '',
        fmtDate(r.occurredAt),
        r.reportedBy ?? '',
        r.rootCauseCategoryLabel ?? '',
        r.rootCause ?? '',
        r.witnessNames ?? '',
        r.reportableToAuthority ? 'Yes' : 'No',
        r.lostTimeInjury ? 'Yes' : 'No',
        r.lostTimeDays ?? '',
        r.openActionCount,
        fmtDate(r.resolvedAt),
        fmtDate(r.closedAt),
      ];

      if (format === 'csv') {
        const lines = [
          COLUMNS.map((c) => csvEscape(c.header)).join(','),
          ...rows.map((r) => rowValues(r).map(csvEscape).join(',')),
        ];
        const body = `\uFEFF${lines.join('\r\n')}`;
        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="hse-incidents-${stamp}.csv"`,
          },
        });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Stride (HSE)';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Incidents', {
        views: [{ state: 'frozen', ySplit: 1 }],
        properties: { tabColor: { argb: 'FF043d4a' } },
      });

      sheet.addRow(COLUMNS.map((c) => c.header));
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF043d4a' } };
      headerRow.alignment = { wrapText: true, vertical: 'middle' };
      headerRow.height = 20;

      for (const r of rows) sheet.addRow(rowValues(r));

      sheet.columns = COLUMNS.map((c) => ({ width: c.width }));

      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        row.eachCell((cell) => {
          cell.border = borderStyle;
          if (i > 1) cell.alignment = { wrapText: true, vertical: 'top' };
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="hse-incidents-${stamp}.xlsx"`,
          'Content-Length': String(buffer.byteLength),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/incidents/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export incidents.' }, { status: 500 });
    }
  });
}
