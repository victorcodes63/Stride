import { DocumentStatus, type Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { parseFormat, respondWithReport } from '@/app/api/reports/_shared';
import type { Cell } from '@/lib/excel-export';

export const dynamic = 'force-dynamic';

const STATUSES = new Set<string>(Object.values(DocumentStatus));

const HEADERS = ['Title', 'Category', 'Department', 'Version', 'Status', 'Effective', 'Expiry'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

function ymd(date: Date | null): string {
  return date ? date.toISOString().split('T')[0] : '';
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const sp = request.nextUrl.searchParams;
      const format = parseFormat(request);
      const category = sp.get('category')?.trim() || undefined;
      const q = sp.get('q')?.trim() || undefined;
      const statusParam = sp.get('status')?.trim() || undefined;
      const includeArchived = sp.get('includeArchived') === '1' || sp.get('includeArchived') === 'true';

      const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;

      const statusWhere: Prisma.CompanyDocumentWhereInput =
        statusParam && STATUSES.has(statusParam)
          ? { status: statusParam as DocumentStatus }
          : includeArchived
            ? {}
            : { status: { not: 'archived' } };

      const searchWhere: Prisma.CompanyDocumentWhereInput = q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { department: { contains: q, mode: 'insensitive' } },
              { fileName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {};

      const where: Prisma.CompanyDocumentWhereInput = {
        ...ctx.where(),
        ...(category ? { category } : {}),
        ...statusWhere,
        ...(entityScope ? { tags: { path: ['entityCode'], equals: entityScope } } : {}),
        ...searchWhere,
      };

      const documents = await ctx.run((tx) =>
        tx.companyDocument.findMany({
          where,
          orderBy: [{ category: 'asc' }, { title: 'asc' }],
          take: 5000,
        }),
      );

      const rows: Cell[][] = documents.map((d) => [
        d.title,
        d.category,
        d.department ?? '',
        d.version ?? '',
        STATUS_LABELS[d.status] ?? d.status,
        ymd(d.effectiveDate),
        ymd(d.expiryDate),
      ]);

      return respondWithReport({
        format,
        json: { documents: rows, total: rows.length },
        title: 'Company Documents',
        sheetName: 'Documents',
        baseFilename: `company-documents-${new Date().toISOString().slice(0, 10)}`,
        headers: HEADERS,
        rows,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/company-documents/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export documents.' }, { status: 500 });
    }
  });
}
