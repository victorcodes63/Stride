import { DocumentStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

const STATUSES = new Set<string>(Object.values(DocumentStatus));

function toResponse(doc: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  version: string | null;
  status: DocumentStatus;
  isPublic: boolean;
  department: string | null;
  tags: unknown;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    fileName: doc.fileName,
    filePath: doc.filePath,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    version: doc.version,
    status: doc.status,
    isPublic: doc.isPublic,
    department: doc.department,
    tags: doc.tags,
    effectiveDate: doc.effectiveDate?.toISOString().split('T')[0] ?? null,
    expiryDate: doc.expiryDate?.toISOString().split('T')[0] ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    // Archived documents remain fetchable so they can be previewed/restored.
    const doc = await ctx.run((tx) =>
      tx.companyDocument.findFirst({
        where: { ...ctx.where(), id },
      }),
    );
    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }
    return NextResponse.json(toResponse(doc));
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const existing = await ctx.run((tx) =>
        tx.companyDocument.findFirst({
          where: { ...ctx.where(), id },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
      }

      const updated = await ctx.run((tx) =>
        tx.companyDocument.update({
          where: { id },
          data: {
            ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
            ...(body.description !== undefined
              ? {
                  description:
                    typeof body.description === 'string'
                      ? body.description.trim() || null
                      : null,
                }
              : {}),
            ...(typeof body.category === 'string' ? { category: body.category.trim() } : {}),
            ...(typeof body.version === 'string' ? { version: body.version.trim() || null } : {}),
            ...(typeof body.department === 'string'
              ? { department: body.department.trim() || null }
              : {}),
            ...(typeof body.status === 'string' && STATUSES.has(body.status)
              ? { status: body.status as DocumentStatus }
              : {}),
            ...(typeof body.isPublic === 'boolean' ? { isPublic: body.isPublic } : {}),
            ...(body.effectiveDate !== undefined
              ? {
                  effectiveDate:
                    typeof body.effectiveDate === 'string' && body.effectiveDate.trim()
                      ? new Date(body.effectiveDate)
                      : null,
                }
              : {}),
            ...(body.expiryDate !== undefined
              ? {
                  expiryDate:
                    typeof body.expiryDate === 'string' && body.expiryDate.trim()
                      ? new Date(body.expiryDate)
                      : null,
                }
              : {}),
          },
        }),
      );

      await ctx.audit({
        action: 'company_document.updated',
        entityType: 'CompanyDocument',
        entityId: id,
        route: 'PATCH /api/company-documents/[id]',
      });

      return NextResponse.json(toResponse(updated));
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/company-documents/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update document.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.companyDocument.findFirst({
          where: { ...ctx.where(), id },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
      }

      await ctx.run((tx) =>
        tx.companyDocument.update({
          where: { id },
          data: { status: 'archived' },
        }),
      );

      await ctx.audit({
        action: 'company_document.archived',
        entityType: 'CompanyDocument',
        entityId: id,
        route: 'DELETE /api/company-documents/[id]',
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/company-documents/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to archive document.' }, { status: 500 });
    }
  });
}
