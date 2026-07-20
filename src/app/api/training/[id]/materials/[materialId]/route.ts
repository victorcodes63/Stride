import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, materialId } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.trainingMaterial.findFirst({
          where: ctx.where({ id: materialId, programId: id }),
          select: { id: true },
        }),
      );
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await withTenantAudit(
        ctx,
        {
          action: 'training.material.deleted',
          entityType: 'TrainingMaterial',
          entityId: materialId,
          route: 'DELETE /api/training/[id]/materials/[materialId]',
          metadata: { programId: id },
        },
        (tx) => tx.trainingMaterial.delete({ where: { id: materialId } }),
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/training/[id]/materials/[materialId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete material.' }, { status: 500 });
    }
  });
}
