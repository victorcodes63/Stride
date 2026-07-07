import { NextRequest, NextResponse } from 'next/server';

import { parseJdManualJson } from '@/lib/performance/jd/jd-manual-import';
import { importJdManual } from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      const contentType = request.headers.get('content-type') ?? '';

      let manualJson: string | null = null;
      let publish = false;
      let skipDuplicates = true;

      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const file = form.get('file');
        publish = form.get('publish') === 'true';
        skipDuplicates = form.get('skipDuplicates') !== 'false';

        if (file instanceof File) {
          manualJson = await file.text();
        } else if (typeof form.get('manual') === 'string') {
          manualJson = form.get('manual') as string;
        }
      } else {
        const body = (await request.json().catch(() => ({}))) as {
          manual?: unknown;
          manualJson?: string;
          publish?: boolean;
          skipDuplicates?: boolean;
        };
        publish = Boolean(body.publish);
        skipDuplicates = body.skipDuplicates !== false;
        if (typeof body.manualJson === 'string') {
          manualJson = body.manualJson;
        } else if (body.manual != null) {
          manualJson = JSON.stringify(body.manual);
        }
      }

      if (!manualJson?.trim()) {
        return NextResponse.json(
          { error: 'Upload a JSON JD manual file or send manual / manualJson in the body.' },
          { status: 400 },
        );
      }

      const parsed = parseJdManualJson(manualJson);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const result = await ctx.run((tx) =>
        importJdManual(tx, {
          organizationId: ctx.organizationId,
          createdByUserId: ctx.staff.id,
          manual: parsed.manual,
          publish,
          skipDuplicates,
        }),
      );

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await ctx.audit({
        action: 'performance.jd.manual_imported',
        entityType: 'JobDescription',
        route: 'POST /api/performance/jds/import-manual',
        metadata: {
          manualName: result.manualName,
          divisionCount: result.divisionCount,
          roleCount: result.roleCount,
          skippedCount: result.skippedCount,
          publish,
        },
      });

      return NextResponse.json(result);
    },
    { adminOnly: true },
  );
}
