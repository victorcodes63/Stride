import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'Title',
  'Status',
  'Priority',
  'Pinned',
  'Requires acknowledgement',
  'Reads',
  'Acknowledgements',
  'Attachments',
  'Published',
  'Expires',
  'Created',
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvCell(value: string | number | boolean): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    try {
      const params = request.nextUrl.searchParams;
      const status = params.get('status')?.trim() || undefined;
      const search = params.get('search')?.trim() || params.get('q')?.trim() || undefined;
      const format = params.get('format')?.trim() === 'xlsx' ? 'xlsx' : 'csv';

      const where: Prisma.AnnouncementWhereInput = {
        ...ctx.where(),
        ...(status ? { status: status as Prisma.AnnouncementWhereInput['status'] } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const rows = await ctx.run((tx) =>
        tx.announcement.findMany({
          where,
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
          include: { _count: { select: { reads: true, attachments: true } } },
        }),
      );

      const ids = rows.map((r) => r.id);
      const ackCounts =
        ids.length > 0
          ? await ctx.run((tx) =>
              tx.announcementRead.groupBy({
                by: ['announcementId'],
                where: { ...ctx.where(), announcementId: { in: ids }, acknowledgedAt: { not: null } },
                _count: { _all: true },
              }),
            )
          : [];
      const ackByAnnouncement = new Map(ackCounts.map((a) => [a.announcementId, a._count._all]));

      const records = rows.map((a) => ({
        title: stripHtml(a.title),
        status: a.status,
        priority: a.priority,
        pinned: a.isPinned ? 'Yes' : 'No',
        requireAck: a.requireAcknowledgement ? 'Yes' : 'No',
        reads: a._count.reads,
        acks: ackByAnnouncement.get(a.id) ?? 0,
        attachments: a._count.attachments,
        published: fmtDate(a.publishedAt),
        expires: fmtDate(a.expiresAt),
        created: fmtDate(a.createdAt),
      }));

      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Stride';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet(`Announcements ${dateStr}`.slice(0, 31), {
          views: [{ state: 'frozen', ySplit: 1 }],
        });
        sheet.addRow([...HEADERS]);
        const header = sheet.getRow(1);
        header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF043d4a' } };
        header.alignment = { wrapText: true, vertical: 'middle' };
        header.height = 22;

        for (const r of records) {
          sheet.addRow([
            r.title,
            r.status,
            r.priority,
            r.pinned,
            r.requireAck,
            r.reads,
            r.acks,
            r.attachments,
            r.published,
            r.expires,
            r.created,
          ]);
        }

        sheet.columns = [48, 12, 12, 10, 16, 8, 16, 12, 14, 14, 14].map((width) => ({ width }));

        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="announcements-${dateStr}.xlsx"`,
            'Content-Length': String(buffer.byteLength),
          },
        });
      }

      const lines = [
        HEADERS.map(csvCell).join(','),
        ...records.map((r) =>
          [
            r.title,
            r.status,
            r.priority,
            r.pinned,
            r.requireAck,
            r.reads,
            r.acks,
            r.attachments,
            r.published,
            r.expires,
            r.created,
          ]
            .map(csvCell)
            .join(','),
        ),
      ];
      const csv = `\uFEFF${lines.join('\r\n')}`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="announcements-${dateStr}.csv"`,
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/announcements/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export announcements.' }, { status: 500 });
    }
  });
}
