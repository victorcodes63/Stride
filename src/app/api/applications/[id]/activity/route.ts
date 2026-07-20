import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export type ApplicationActivityItem = {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  reason: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Application id required' }, { status: 400 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ items: [] });
    }

    try {
      const events = await ctx.run((tx) =>
        tx.auditEvent.findMany({
          where: ctx.where({ entityType: 'application', entityId: id }),
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { actor: { select: { name: true } } },
        }),
      );

      const items: ApplicationActivityItem[] = events.map((e) => {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        return {
          id: e.id,
          action: e.action,
          from: typeof meta.from === 'string' ? meta.from : null,
          to: typeof meta.to === 'string' ? meta.to : null,
          reason: typeof meta.reason === 'string' ? meta.reason : null,
          actorName: e.actor?.name ?? null,
          actorEmail: e.actorEmail ?? null,
          createdAt: e.createdAt.toISOString(),
        };
      });

      return NextResponse.json({ items });
    } catch {
      return NextResponse.json({ items: [] });
    }
  });
}
