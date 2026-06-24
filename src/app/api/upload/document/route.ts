import { NextRequest, NextResponse } from 'next/server';
import { DocumentUploadError, uploadEmployeeDocument } from '@/lib/document-upload';
import { logAuditEvent } from '@/lib/audit-events';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function POST(request: NextRequest) {
  try {
    const staffUser = await requireStaffUser(request);
    const essUser = staffUser ? null : await requireEssUser(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 });
    }
    const uploaded = await uploadEmployeeDocument(file);
    await logAuditEvent({
      actor: {
        userId: staffUser?.id ?? essUser?.id ?? null,
        email: staffUser?.email ?? essUser?.email ?? null,
        name: staffUser?.name ?? essUser?.name ?? null,
      },
      action: 'document.uploaded',
      entityType: 'Document',
      entityId: uploaded.path,
      route: 'POST /api/upload/document',
      metadata: { mimeType: file.type, size: file.size },
    });
    return NextResponse.json({ url: uploaded.url, path: uploaded.path });
  } catch (err) {
    if (err instanceof DocumentUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Document upload error:', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
