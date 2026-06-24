import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStaffSession } from '@/lib/auth-session';
import { ensureUniqueSlug, insightSlugBase } from '@/lib/slug';

function requireStaff(request: NextRequest): NextResponse | null {
  const raw = request.cookies.get('staff_session')?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const parsed = parseStaffSession(raw);
  if (!parsed.userId && !parsed.email) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }
  return null;
}

function toJson(insight: {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string;
  body: string | null;
  author: string;
  category: string;
  url: string;
  image: string;
  imageTitle: string | null;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: insight.id,
    slug: insight.slug ?? null,
    title: insight.title,
    excerpt: insight.excerpt,
    body: insight.body ?? null,
    date: insight.publishedAt.toISOString().split('T')[0],
    author: insight.author,
    category: insight.category,
    url: insight.url,
    image: insight.image,
    imageTitle: insight.imageTitle ?? null,
    publishedAt: insight.publishedAt.toISOString(),
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
  };
}

/** GET: fetch single insight by id (staff only, for edit page). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireStaff(_request);
  if (auth) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Insights are not available without a database.' },
        { status: 503 }
      );
    }

    const insight = await prisma.insight.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!insight) {
      return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });
    }
    return NextResponse.json(toJson(insight));
  } catch (e) {
    console.error('Insights GET [id] error:', e);
    return NextResponse.json(
      { error: 'Failed to load insight.' },
      { status: 500 }
    );
  }
}

/** PATCH: update insight (staff only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireStaff(request);
  if (auth) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const updates: { title?: string; excerpt?: string; body?: string | null; author?: string; category?: string; url?: string; image?: string; imageTitle?: string | null; slug?: string } = {};
  if (typeof b.title === 'string') updates.title = b.title.trim();
  if (typeof b.excerpt === 'string') updates.excerpt = b.excerpt.trim();
  if (b.body !== undefined) updates.body = typeof b.body === 'string' ? b.body.trim() || null : null;
  if (typeof b.author === 'string') updates.author = b.author.trim();
  if (typeof b.category === 'string') updates.category = b.category.trim();
  if (typeof b.url === 'string') updates.url = b.url.trim();
  if (typeof b.image === 'string') updates.image = b.image.trim();
  if (b.imageTitle !== undefined) updates.imageTitle = typeof b.imageTitle === 'string' ? b.imageTitle.trim() || null : null;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Insights are not available without a database.' },
        { status: 503 }
      );
    }

    const existing = await prisma.insight.findUnique({
      where: { id },
      select: { slug: true, title: true },
    });
    if (existing?.slug == null) {
      const baseSlug = insightSlugBase(updates.title ?? existing?.title ?? 'insight', id.slice(0, 8));
      const slug = await ensureUniqueSlug(baseSlug, async (s) => {
        const other = await prisma.insight.findFirst({
          where: { slug: s, id: { not: id } },
        });
        return !!other;
      });
      updates.slug = slug;
      if (!updates.url) updates.url = `/insights/${slug}`;
    }

    const insight = await prisma.insight.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json(toJson(insight));
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });
    }
    console.error('Insights PATCH error:', e);
    return NextResponse.json(
      { error: 'Failed to update insight.' },
      { status: 500 }
    );
  }
}

/** DELETE: remove insight (staff only). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireStaff(_request);
  if (auth) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Insights are not available without a database.' },
        { status: 503 }
      );
    }

    await prisma.insight.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });
    }
    console.error('Insights DELETE error:', e);
    return NextResponse.json(
      { error: 'Failed to delete insight.' },
      { status: 500 }
    );
  }
}
