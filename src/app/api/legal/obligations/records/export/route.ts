import { NextRequest, NextResponse } from 'next/server';
import type {
  LegalObligationCategory,
  LegalObligationPriority,
  LegalObligationStatus,
  Prisma,
} from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { parseFormat, respondWithReport } from '@/app/api/reports/_shared';
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from '@/lib/legal/constants';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set<LegalObligationCategory>([
  'filing',
  'permit',
  'licence',
  'board',
  'regulator',
  'insurance',
  'other',
]);
const STATUSES = new Set<LegalObligationStatus>(['pending', 'completed', 'waived']);
const PRIORITIES = new Set<LegalObligationPriority>(['low', 'medium', 'high', 'critical']);
const SORT_KEYS = new Set(['dueDate', 'priority', 'title', 'status']);

function parseDate(value: string | null): Date | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const sp = request.nextUrl.searchParams;
      const format = parseFormat(request);
      const status = sp.get('status')?.trim();
      const category = sp.get('category')?.trim();
      const priority = sp.get('priority')?.trim();
      const ownerUserId = sp.get('ownerUserId')?.trim();
      const q = sp.get('q')?.trim();
      const dueBefore = parseDate(sp.get('dueBefore'));
      const dueAfter = parseDate(sp.get('dueAfter'));
      const sort = sp.get('sort')?.trim();
      const dir = sp.get('dir')?.trim() === 'desc' ? 'desc' : 'asc';

      const dueFilter: Prisma.DateTimeFilter = {};
      if (dueAfter) dueFilter.gte = dueAfter;
      if (dueBefore) dueFilter.lte = dueBefore;

      const where: Prisma.LegalObligationWhereInput = {
        ...ctx.where(),
        ...(status && STATUSES.has(status as LegalObligationStatus)
          ? { status: status as LegalObligationStatus }
          : {}),
        ...(category && CATEGORIES.has(category as LegalObligationCategory)
          ? { category: category as LegalObligationCategory }
          : {}),
        ...(priority && PRIORITIES.has(priority as LegalObligationPriority)
          ? { priority: priority as LegalObligationPriority }
          : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(Object.keys(dueFilter).length ? { dueDate: dueFilter } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { regulator: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const orderBy: Prisma.LegalObligationOrderByWithRelationInput[] =
        sort && SORT_KEYS.has(sort)
          ? [{ [sort]: dir } as Prisma.LegalObligationOrderByWithRelationInput, { title: 'asc' }]
          : [{ dueDate: 'asc' }, { title: 'asc' }];

      const rows = await ctx.run((tx) =>
        tx.legalObligation.findMany({
          where,
          include: { owner: { select: { name: true } } },
          orderBy,
          take: 5000,
        }),
      );

      const headers = ['Due date', 'Title', 'Category', 'Priority', 'Status', 'Owner', 'Regulator'];
      const dataRows = rows.map((r) => [
        r.dueDate.toISOString().slice(0, 10),
        r.title,
        CATEGORY_LABEL[r.category],
        PRIORITY_LABEL[r.priority],
        STATUS_LABEL[r.status],
        r.owner?.name ?? '',
        r.regulator ?? '',
      ]);

      return respondWithReport({
        format,
        json: { records: dataRows },
        title: 'Compliance obligations register',
        sheetName: 'Obligations',
        baseFilename: `obligations-register-${new Date().toISOString().slice(0, 10)}`,
        headers,
        rows: dataRows,
        summaryLines: [`${rows.length} obligation${rows.length === 1 ? '' : 's'}`],
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/legal/obligations/records/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export compliance obligations.' }, { status: 500 });
    }
  });
}
