import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { getAccountsAccess } from '@/lib/accounts-access';
import { BrandingUploadError, uploadBrandingImage } from '@/lib/branding-upload';
import {
  loadRawInvoiceSetupSettings,
  persistInvoiceSetupSettings,
  sanitizeInvoiceSetup,
} from '@/lib/invoice-setup';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role, ctx.organizationId);
    if (!access.canManageInvoices) {
      return NextResponse.json({ error: 'No permission to manage invoicing setup.' }, { status: 403 });
    }

    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing image file.' }, { status: 400 });
      }

      const uploaded = await uploadBrandingImage(file, 'logo');
      const stored = await loadRawInvoiceSetupSettings(ctx.organizationId);
      const merged = sanitizeInvoiceSetup({ ...stored, logoSrc: uploaded.path });

      await persistInvoiceSetupSettings(ctx.organizationId, merged, ctx.staff.id);

      return NextResponse.json({
        logoSrc: merged.logoSrc,
        uploadedUrl: uploaded.url,
      });
    } catch (error) {
      if (error instanceof BrandingUploadError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      await reportApiError({
        route: 'POST /api/accounts/invoice-setup/upload',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to upload logo.' }, { status: 500 });
    }
  });
}
