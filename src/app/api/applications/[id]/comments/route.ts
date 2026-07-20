import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export type ApplicationCommentItem = {
  id: string;
  body: string;
  mentions: string[];
  authorUserId: string;
  authorName: string | null;
  authorEmail: string | null;
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
      const comments = await ctx.run((tx) =>
        tx.applicationComment.findMany({
          where: ctx.where({ applicationId: id }),
          orderBy: { createdAt: 'asc' },
          take: 200,
          include: { author: { select: { name: true, email: true } } },
        }),
      );
      const items: ApplicationCommentItem[] = comments.map((c) => ({
        id: c.id,
        body: c.body,
        mentions: c.mentions,
        authorUserId: c.authorUserId,
        authorName: c.author?.name ?? null,
        authorEmail: c.author?.email ?? null,
        createdAt: c.createdAt.toISOString(),
      }));
      return NextResponse.json({ items });
    } catch {
      return NextResponse.json({ items: [] });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Application id required' }, { status: 400 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const text = typeof b.body === 'string' ? b.body.trim() : '';
    const rawMentions = Array.isArray(b.mentions)
      ? (b.mentions.filter((m) => typeof m === 'string') as string[])
      : [];
    if (!text) {
      return NextResponse.json({ error: 'Comment body required.' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Comment too long (max 5000 characters).' }, { status: 400 });
    }

    try {
      const application = await ctx.run((tx) =>
        tx.application.findFirst({
          where: ctx.where({ id }),
          include: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } },
        }),
      );
      if (!application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
      }

      // Only notify real active members of this org (defends against spoofed ids).
      const members = await ctx.run((tx) =>
        tx.organizationMembership.findMany({
          where: { organizationId: ctx.organizationId, status: 'active' },
          select: { userId: true },
        }),
      );
      const validMemberIds = new Set(members.map((m) => m.userId));
      const mentions = [...new Set(rawMentions)].filter(
        (m) => validMemberIds.has(m) && m !== ctx.staff.id,
      );

      const created = await ctx.run((tx) =>
        tx.applicationComment.create({
          data: {
            organizationId: ctx.organizationId,
            applicationId: id,
            authorUserId: ctx.staff.id,
            body: text,
            mentions,
          },
          include: { author: { select: { name: true, email: true } } },
        }),
      );

      if (mentions.length > 0) {
        const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`.trim();
        const authorName = created.author?.name ?? ctx.staff.email;
        const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
        await ctx.run((tx) =>
          tx.staffNotification.createMany({
            data: mentions.map((userId) => ({
              organizationId: ctx.organizationId,
              userId,
              title: `${authorName} mentioned you on ${candidateName || 'an application'}`,
              body: `${application.job.title}: ${preview}`,
              href: `/dashboard/applications?applicationId=${id}`,
              event: 'application.comment_mention',
              priority: 'info',
            })),
          }),
        );
      }

      const item: ApplicationCommentItem = {
        id: created.id,
        body: created.body,
        mentions: created.mentions,
        authorUserId: created.authorUserId,
        authorName: created.author?.name ?? null,
        authorEmail: created.author?.email ?? null,
        createdAt: created.createdAt.toISOString(),
      };
      return NextResponse.json(item, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to save comment.' }, { status: 500 });
    }
  });
}
