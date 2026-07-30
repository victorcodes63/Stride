import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  return withTenant(request, async (ctx) => {
    const { id } = await context.params;
    const share = await ctx.run((tx) =>
      tx.personalCalendarShare.findFirst({
        where: { id, organizationId: ctx.organizationId },
      }),
    );
    if (!share) return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
    if (share.ownerId !== ctx.staff.id && ctx.staff.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    await ctx.run((tx) =>
      tx.personalCalendarShare.update({
        where: { id },
        data: { status: 'revoked' },
      }),
    );
    return NextResponse.json({ ok: true });
  });
}
