import { NextRequest, NextResponse } from 'next/server';
import { DocumentUploadError } from '@/lib/document-upload';
import { uploadCompanyDocument } from '@/lib/company-document-upload';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 });
      }

      const uploaded = await uploadCompanyDocument(file);

      await ctx.audit({
        action: 'company_document.uploaded',
        entityType: 'CompanyDocument',
        entityId: uploaded.path,
        route: 'POST /api/company-documents/upload',
        metadata: { fileName: uploaded.fileName, size: uploaded.fileSize },
      });

      return NextResponse.json({
        filePath: uploaded.path,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        url: uploaded.url,
      });
    } catch (error) {
      if (error instanceof DocumentUploadError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      await reportApiError({
        route: 'POST /api/company-documents/upload',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
    }
  });
}
