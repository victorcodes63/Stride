import { NextRequest, NextResponse } from 'next/server';
import type { EmployeeDocumentCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessEmployeeDocuments,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { DocumentUploadError, uploadEmployeeDocument } from '@/lib/document-upload';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

const CATEGORIES = new Set([
  'CONTRACT',
  'IDENTIFICATION',
  'QUALIFICATION',
  'PERFORMANCE',
  'DISCIPLINARY',
  'POLICY_ACKNOWLEDGMENT',
  'MEDICAL',
  'OTHER',
]);

function canViewMedicalDocuments(role: string, staffUserType: string) {
  return role === 'admin' || staffUserType === 'business_manager';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessEmployeeDocuments(user)) {
    return forbiddenResponse('Document access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const { id } = await params;
  const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const includeMedical = canViewMedicalDocuments(user.role, user.staffUserType);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category')?.trim().toUpperCase();
  const verifiedOnly = searchParams.get('verifiedOnly') === 'true';

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, outsourcingClientId: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (employee.outsourcingClientId !== workspaceId) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const documents = await prisma.employeeDocument.findMany({
    where: {
      employeeId: id,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { fileName: { contains: q, mode: 'insensitive' } },
              { documentNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(category && CATEGORIES.has(category) ? { category: category as never } : {}),
      ...(verifiedOnly ? { isVerified: true } : {}),
      ...(includeMedical ? {} : { category: { not: 'MEDICAL' } }),
    },
    include: {
      uploader: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { uploadedAt: 'desc' }],
  });

  return NextResponse.json(
    documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      documentNumber: doc.documentNumber,
      issuedOn: doc.issuedOn?.toISOString().slice(0, 10) ?? null,
      expiresOn: doc.expiresOn?.toISOString().slice(0, 10) ?? null,
      isVerified: doc.isVerified,
      tags: doc.tags,
      uploadedBy: doc.uploader,
      uploadedAt: doc.uploadedAt.toISOString(),
      notes: doc.notes,
      downloadUrl: `/api/outsourcing/employees/${id}/documents/${doc.id}/download`,
      filePath: doc.filePath,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessEmployeeDocuments(user)) {
    return forbiddenResponse('Document access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;
  const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, outsourcingClientId: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (employee.outsourcingClientId !== workspaceId) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const titleRaw = formData.get('title');
    const categoryRaw = formData.get('category');
    const notesRaw = formData.get('notes');
    const documentNumberRaw = formData.get('documentNumber');
    const issuedOnRaw = formData.get('issuedOn');
    const expiresOnRaw = formData.get('expiresOn');
    const isVerifiedRaw = formData.get('isVerified');
    const tagsRaw = formData.get('tags');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 });
    }
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    const category = typeof categoryRaw === 'string' ? categoryRaw.trim().toUpperCase() : '';
    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid document category' }, { status: 400 });
    }
    if (category === 'MEDICAL' && !canViewMedicalDocuments(user.role, user.staffUserType)) {
      return forbiddenResponse('Medical documents are restricted to HR and admins.');
    }

    const uploaded = await uploadEmployeeDocument(file);
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() || null : null;
    const documentNumber = typeof documentNumberRaw === 'string' ? documentNumberRaw.trim() || null : null;
    const issuedOn =
      typeof issuedOnRaw === 'string' && issuedOnRaw.trim()
        ? new Date(issuedOnRaw.trim())
        : null;
    const expiresOn =
      typeof expiresOnRaw === 'string' && expiresOnRaw.trim()
        ? new Date(expiresOnRaw.trim())
        : null;
    const isVerified = typeof isVerifiedRaw === 'string' ? isVerifiedRaw === 'true' : false;
    const tags =
      typeof tagsRaw === 'string' && tagsRaw.trim()
        ? tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    const created = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        title,
        category: category as EmployeeDocumentCategory,
        filePath: uploaded.path,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        documentNumber,
        issuedOn: issuedOn && !Number.isNaN(issuedOn.getTime()) ? issuedOn : null,
        expiresOn: expiresOn && !Number.isNaN(expiresOn.getTime()) ? expiresOn : null,
        isVerified,
        tags,
        notes,
        uploadedBy: user.id,
      },
      include: {
        uploader: { select: { name: true, email: true } },
      },
    });

    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'employee.document.upload',
      entityType: 'EmployeeDocument',
      entityId: created.id,
      route: 'POST /api/outsourcing/employees/[id]/documents',
      metadata: {
        employeeId: id,
        title: created.title,
        category: created.category,
        fileName: created.fileName,
        fileSize: created.fileSize,
        documentNumber: created.documentNumber,
        issuedOn: created.issuedOn?.toISOString().slice(0, 10) ?? null,
        expiresOn: created.expiresOn?.toISOString().slice(0, 10) ?? null,
        isVerified: created.isVerified,
        tags: created.tags,
      },
    });
    try {
      const essId = await getEssPortalUserIdForEmployee(id);
      if (essId) {
        await sendNotification({
          event: 'document_uploaded',
          recipientEssPortalUserIds: [essId],
          title: 'Document added',
          body: `A new document (${created.title}) has been added to your profile.`,
          href: '/ess/profile',
          priority: 'info',
          channel: 'in_app',
          metadata: { employeeId: id, documentId: created.id, docTitle: created.title },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send document_uploaded:', err);
    }

    return NextResponse.json(
      {
        id: created.id,
        title: created.title,
        category: created.category,
        fileName: created.fileName,
        fileSize: created.fileSize,
        mimeType: created.mimeType,
        uploadedBy: created.uploader,
        uploadedAt: created.uploadedAt.toISOString(),
        notes: created.notes,
        downloadUrl: `/api/outsourcing/employees/${id}/documents/${created.id}/download`,
        filePath: created.filePath,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DocumentUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[employee documents POST]', error);
    return NextResponse.json({ error: 'Failed to upload employee document' }, { status: 500 });
  }
}
