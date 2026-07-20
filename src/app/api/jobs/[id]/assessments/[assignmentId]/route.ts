import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id: jobId, assignmentId } = await params;

    const deleted = await ctx.run(async (tx) => {
      const native = await tx.jobAssessmentAssignment.findFirst({ where: { id: assignmentId, jobId, organizationId: ctx.organizationId } });
      if (native) {
        await tx.jobAssessmentAssignment.delete({ where: { id: assignmentId } });
        return true;
      }
      const external = await tx.jobExternalAssessmentAssignment.findFirst({ where: { id: assignmentId, jobId, organizationId: ctx.organizationId } });
      if (external) {
        await tx.jobExternalAssessmentAssignment.delete({ where: { id: assignmentId } });
        return true;
      }
      return false;
    });

    if (!deleted) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
    await ctx.audit({ action: 'ats.assessment.unassigned', entityType: 'Job', entityId: jobId });
    return NextResponse.json({ ok: true });
  });
}
