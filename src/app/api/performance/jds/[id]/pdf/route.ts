import { NextRequest, NextResponse } from 'next/server';

import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { brand } from '@/lib/brand';
import {
  generateJobDescriptionPdf,
  jdPdfFilename,
} from '@/lib/performance/jd/jd-pdf';
import { serializeJobDescriptionDetail } from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const row = await ctx.run((tx) =>
      tx.jobDescription.findFirst({
        where: ctx.where({ id }),
        include: {
          division: { select: { name: true } },
          kras: {
            orderBy: { sortOrder: 'asc' },
            include: { kpis: { orderBy: { sortOrder: 'asc' } } },
          },
          competencies: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { kras: true, competencies: true } },
        },
      }),
    );

    if (!row) {
      return NextResponse.json({ error: 'Job description not found' }, { status: 404 });
    }

    const setup = await loadCompanySetupSettingsForOrg(ctx.organizationId);
    const jd = serializeJobDescriptionDetail(row);
    const pdfBuffer = await generateJobDescriptionPdf(jd, {
      orgName: setup.payslipLegalName.trim() || setup.orgName.trim() || brand.orgName,
      documentFooter: setup.documentFooterText.trim() || setup.publicFooterText.trim() || null,
      contactAddress: setup.contactAddress.trim() || brand.contactAddress || null,
    });

    await ctx.audit({
      action: 'performance.jd.pdf_exported',
      entityType: 'JobDescription',
      entityId: id,
      route: 'GET /api/performance/jds/[id]/pdf',
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${jdPdfFilename(jd.title)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
