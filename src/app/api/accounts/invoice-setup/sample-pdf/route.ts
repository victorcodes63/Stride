import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { generateSampleAccountsInvoicePdf } from '@/lib/accounts-invoice-pdf';
import { resolveInvoicePdfBranding, type InvoiceStyle } from '@/lib/invoice-setup';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function parsePreviewStyle(value: string | null): InvoiceStyle | null {
  if (value === 'plain' || value === 'branded') return value;
  return null;
}

export async function GET(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    try {
      const branding = await resolveInvoicePdfBranding(ctx.organizationId);
      const styleOverride = parsePreviewStyle(request.nextUrl.searchParams.get('style'));
      const previewBranding = styleOverride
        ? { ...branding, invoiceStyle: styleOverride, letterheadMode: styleOverride === 'branded' ? 'embedded_logo' as const : 'preprinted' as const }
        : branding;
      const pdfBytes = await generateSampleAccountsInvoicePdf(previewBranding);

      const q = request.nextUrl.searchParams.get('disposition');
      const isInline = q === 'inline';
      const styleLabel = previewBranding.invoiceStyle === 'branded' ? 'branded' : 'plain';

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': isInline
            ? `inline; filename="Sample-invoice-${styleLabel}.pdf"`
            : `attachment; filename="Sample-invoice-${styleLabel}.pdf"`,
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
