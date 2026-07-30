import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

async function respondToInvite(request: NextRequest, context: Context) {
  return withTenant(request, async (ctx) => {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status === 'declined' ? 'declined' : body?.status === 'accepted' ? 'accepted' : null;
    if (!status) {
      return NextResponse.json({ error: 'status must be accepted or declined.' }, { status: 400 });
    }

    const participant = await ctx.run((tx) =>
      tx.companyCalendarEventParticipant.findFirst({
        where: {
          eventId: id,
          userId: ctx.staff.id,
          organizationId: ctx.organizationId,
        },
      }),
    );
    if (!participant) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    const updated = await ctx.run((tx) =>
      tx.companyCalendarEventParticipant.update({
        where: { id: participant.id },
        data: { status, respondedAt: new Date() },
      }),
    );
    return NextResponse.json({ participant: updated });
  });
}

/** UI uses PATCH; keep POST for compatibility. */
export async function PATCH(request: NextRequest, context: Context) {
  return respondToInvite(request, context);
}

export async function POST(request: NextRequest, context: Context) {
  return respondToInvite(request, context);
}
