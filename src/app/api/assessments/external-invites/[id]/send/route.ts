import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { sendExternalInvite } from '@/lib/assessments/external-invites';
import { externalInviteQuotaReached } from '@/lib/assessments/usage';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    if (await externalInviteQuotaReached(ctx.organizationId)) {
      return NextResponse.json({ error: 'Monthly external assessment quota reached.' }, { status: 402 });
    }

    try {
      const result = await sendExternalInvite(ctx.organizationId, id);
      await ctx.audit({ action: 'ats.external_invite.sent', entityType: 'ExternalAssessmentInvite', entityId: id });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to send invite.' }, { status: 502 });
    }
  });
}
