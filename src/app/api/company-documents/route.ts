import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
      const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;
      const documents = await ctx.run((tx) =>
        tx.companyDocument.findMany({
          where: {
            ...ctx.where(),
            ...(category ? { category } : {}),
            status: { not: 'archived' },
            ...(entityScope
              ? { tags: { path: ['entityCode'], equals: entityScope } }
              : {}),
          },
          orderBy: [{ category: 'asc' }, { title: 'asc' }],
          take: 200,
        }),
      );

      return NextResponse.json({
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          fileName: d.fileName,
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
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, description, category, filePath, fileName, fileSize, mimeType, version, department, tags, effectiveDate, expiryDate, isPublic } = body;
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
            tags: tags || null,
            effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          },
        }),
      );

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
