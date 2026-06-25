import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeResolution } from '@/lib/governance/serialize';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (typeof body.description === 'string') data.description = body.description.trim() || null;
  if (
    typeof body.status === 'string' &&
    ['draft', 'adopted', 'rejected', 'withdrawn'].includes(body.status)
  ) {
    data.status = body.status;
    if (body.status === 'adopted') data.adoptedAt = new Date();
  }
  if (typeof body.effectiveDate === 'string') {
    data.effectiveDate = body.effectiveDate.trim() ? new Date(body.effectiveDate) : null;
  }
  if (typeof body.meetingId === 'string') {
    data.meetingId = body.meetingId.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.governanceResolution.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.governanceResolution.update({
      where: { id },
      data,
      include: {
        meeting: { select: { id: true, meetingCode: true, title: true } },
        _count: { select: { actions: true } },
      },
    });

    return NextResponse.json({ resolution: serializeResolution(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/governance/resolutions/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update resolution.' }, { status: 500 });
  }
}
