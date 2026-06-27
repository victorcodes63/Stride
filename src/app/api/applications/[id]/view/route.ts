import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withTenant(request, async (ctx) => {
    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json({ error: 'Application id required' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: true });
    }

    try {
      const app = await ctx.run((tx) =>
        tx.application.findFirst({
          where: ctx.where({ id: applicationId }),
          select: { id: true },
        }),
      );
      if (!app) {
        return NextResponse.json({ ok: true });
      }

      await ctx.run((tx) =>
        tx.applicationView.upsert({
          where: { applicationId_userId: { applicationId, userId: ctx.staff.id } },
          create: { organizationId: ctx.organizationId, applicationId, userId: ctx.staff.id },
          update: { viewedAt: new Date() },
        }),
      );
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: true });
    }
  });
}
