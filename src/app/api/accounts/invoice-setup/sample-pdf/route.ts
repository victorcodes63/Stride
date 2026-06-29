import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { generateSampleAccountsInvoicePdf } from '@/lib/accounts-invoice-pdf';
import { resolveInvoicePdfBranding } from '@/lib/invoice-setup';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    try {
      const branding = await resolveInvoicePdfBranding(ctx.organizationId);
      const pdfBytes = await generateSampleAccountsInvoicePdf(branding);

      const q = request.nextUrl.searchParams.get('disposition');
      const isInline = q === 'inline';

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': isInline
            ? 'inline; filename="Sample-invoice.pdf"'
            : 'attachment; filename="Sample-invoice.pdf"',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/accounts/invoice-setup/sample-pdf',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate sample PDF.' }, { status: 500 });
    }
  });
}
