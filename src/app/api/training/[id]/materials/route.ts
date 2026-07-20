import type { TrainingMaterial } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import { mapMaterial } from '@/lib/training/service';
import type { TrainingMaterialInput } from '@/lib/training/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: TrainingMaterialInput;
    try {
      body = (await request.json()) as TrainingMaterialInput;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    try {
      const program = await ctx.run((tx) =>
        tx.trainingProgram.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const material = await withTenantAudit<TrainingMaterial>(
        ctx,
        {
          action: 'training.material.created',
          entityType: 'TrainingMaterial',
          route: 'POST /api/training/[id]/materials',
          entityIdFromResult: (m) => m.id,
          metadata: { programId: id },
        },
        (tx) =>
          tx.trainingMaterial.create({
            data: {
              organizationId: ctx.organizationId,
              programId: id,
              title: body.title.trim(),
              externalUrl: body.externalUrl?.trim() || null,
              filePath: body.filePath?.trim() || null,
              sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
            },
          }),
      );

      return NextResponse.json({ material: mapMaterial(material) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/training/[id]/materials',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create material.' }, { status: 500 });
    }
  });
}
