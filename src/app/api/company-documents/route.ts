import { DocumentStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const STATUSES = new Set<string>(Object.values(DocumentStatus));

const SORT_FIELDS = {
  title: 'title',
  category: 'category',
  department: 'department',
  version: 'version',
  status: 'status',
  effectiveDate: 'effectiveDate',
  expiryDate: 'expiryDate',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
} as const;

type SortField = keyof typeof SORT_FIELDS;

function parseSort(value: string | null): SortField {
  return value && value in SORT_FIELDS ? (value as SortField) : 'title';
}

function parseDir(value: string | null): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc';
}

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const sp = request.nextUrl.searchParams;
      const category = sp.get('category')?.trim() || undefined;
      const q = sp.get('q')?.trim() || undefined;
      const statusParam = sp.get('status')?.trim() || undefined;
      const includeArchived = sp.get('includeArchived') === '1' || sp.get('includeArchived') === 'true';
      const sortField = parseSort(sp.get('sort'));
      const dir = parseDir(sp.get('dir'));
      const page = parseIntParam(sp.get('page'), 1, 1, 100000);
      const pageSize = parseIntParam(sp.get('pageSize'), 20, 1, 100);

      const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;

      // Status filter: an explicit valid status pins to it; otherwise archived is
      // hidden unless `includeArchived=1`.
      const statusWhere: Prisma.CompanyDocumentWhereInput =
        statusParam && STATUSES.has(statusParam)
          ? { status: statusParam as DocumentStatus }
          : includeArchived
            ? {}
            : { status: { not: 'archived' } };

      const entityWhere: Prisma.CompanyDocumentWhereInput = entityScope
        ? { tags: { path: ['entityCode'], equals: entityScope } }
        : {};

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
        ...entityWhere,
        ...searchWhere,
      };

      const orderBy: Prisma.CompanyDocumentOrderByWithRelationInput[] = [
        { [SORT_FIELDS[sortField]]: dir },
      ];
      // Stable tiebreaker so pagination is deterministic.
      if (sortField !== 'title') orderBy.push({ title: 'asc' });

      const { documents, total, summary } = await ctx.run(async (tx) => {
        const [documents, total, summaryDocs] = await Promise.all([
          tx.companyDocument.findMany({
            where,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.companyDocument.count({ where }),
          // Summary spans the whole library (entity-scoped), independent of the
          // active list filters/pagination.
          tx.companyDocument.findMany({
            where: { ...ctx.where(), ...entityWhere },
            select: { status: true, expiryDate: true },
          }),
        ]);

        const now = Date.now();
        const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;
        let published = 0;
        let archived = 0;
        let expiringSoon = 0;
        let expired = 0;
        for (const d of summaryDocs) {
          if (d.status === 'archived') archived += 1;
          if (d.status === 'published') published += 1;
          const expiry = d.expiryDate ? d.expiryDate.getTime() : null;
          if (expiry != null && d.status !== 'archived') {
            if (expiry < now) expired += 1;
            else if (expiry <= soonCutoff) expiringSoon += 1;
          }
        }

        return {
          documents,
          total,
          summary: {
            total: summaryDocs.length,
            published,
            archived,
            expiringSoon,
            expired,
          },
        };
      });

      return NextResponse.json({
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          fileName: d.fileName,
          filePath: d.filePath,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          version: d.version,
          status: d.status,
          isPublic: d.isPublic,
          department: d.department,
          tags: d.tags,
          effectiveDate: d.effectiveDate?.toISOString().split('T')[0] ?? null,
          expiryDate: d.expiryDate?.toISOString().split('T')[0] ?? null,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        summary,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/company-documents',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load documents.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, description, category, filePath, fileName, fileSize, mimeType, version, department, tags, effectiveDate, expiryDate, isPublic } =
      body as {
        title?: string;
        description?: string;
        category?: string;
        filePath?: string;
        fileName?: string;
        fileSize?: number | string;
        mimeType?: string;
        version?: string;
        department?: string;
        tags?: Prisma.InputJsonValue;
        effectiveDate?: string;
        expiryDate?: string;
        isPublic?: boolean;
      };
    if (!title?.trim() || !category?.trim() || !filePath?.trim() || !fileName?.trim()) {
      return NextResponse.json({ error: 'Title, category, file path, and file name are required.' }, { status: 400 });
    }

    try {
      const doc = await ctx.run((tx) =>
        tx.companyDocument.create({
          data: {
            organizationId: ctx.organizationId,
            title: title.trim(),
            description: description?.trim() || null,
            category: category.trim(),
            filePath: filePath.trim(),
            fileName: fileName.trim(),
            fileSize: fileSize ? Number(fileSize) : null,
            mimeType: mimeType?.trim() || null,
            version: version?.trim() || null,
            status: 'published',
            isPublic: isPublic ?? false,
            uploadedByUserId: ctx.staff.id,
            department: department?.trim() || null,
            tags: tags ?? Prisma.DbNull,
            effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          },
        }),
      );

      await ctx.audit({
        action: 'company_document.created',
        entityType: 'CompanyDocument',
        entityId: doc.id,
        route: 'POST /api/company-documents',
        metadata: { title: doc.title, category: doc.category },
      });

      return NextResponse.json({ id: doc.id }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/company-documents',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create document.' }, { status: 500 });
    }
  });
}
