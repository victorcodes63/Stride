import { NextRequest, NextResponse } from 'next/server';

import { parseJobDescriptionDraft } from '@/lib/performance/parsing/registry';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      fileName?: string;
      mimeType?: string | null;
      text?: string;
    };

    const fileName = body.fileName?.trim() || 'upload.txt';
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: 'text is required (extract PDF/docx to text client-side or via upload pipeline)' }, { status: 400 });
    }

    const config = await ctx.run((tx) =>
      tx.jdParserConfig.findUnique({ where: { organizationId: ctx.organizationId } }),
    );

    const mode = config?.mode ?? 'manual';
    const aiConsented = Boolean(config?.consentAt && (mode === 'stride' || mode === 'byo'));

    const result = await parseJobDescriptionDraft(
      mode,
      { fileName, mimeType: body.mimeType ?? null, text },
      {
        organizationId: ctx.organizationId,
        aiConsented,
        apiKeyRef: config?.apiKeyRef ?? null,
        promptTemplate: config?.promptTemplate ?? null,
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await ctx.audit({
      action: 'performance.jd.parse_preview',
      entityType: 'JobDescription',
      route: 'POST /api/performance/jds/parse',
      metadata: { mode, fileName, aiConsented },
    });

    return NextResponse.json({
      draft: result.draft,
      warnings: result.warnings ?? [],
      requiresHumanConfirm: true,
    });
  });
}
