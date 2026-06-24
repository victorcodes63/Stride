import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStaffSession } from '@/lib/auth-session';
import { ensureUniqueSlug, insightSlugBase } from '@/lib/slug';

/** GET: list insights (public). Ordered by publishedAt desc. */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([]);
    }
    const list = await prisma.insight.findMany({
      orderBy: { publishedAt: 'desc' },
    });
    return NextResponse.json(
      list.map((i) => ({
        id: i.id,
        slug: i.slug ?? null,
        title: i.title,
        excerpt: i.excerpt,
        body: i.body ?? null,
        date: i.publishedAt.toISOString().split('T')[0],
        author: i.author,
        category: i.category,
        url: i.url,
        image: i.image,
        imageTitle: i.imageTitle ?? null,
        publishedAt: i.publishedAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}

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

/** POST: create insight (staff only). */
export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const excerpt = typeof b.excerpt === 'string' ? b.excerpt.trim() : '';
  const articleBody = typeof b.body === 'string' ? b.body.trim() || null : null;
  const author = typeof b.author === 'string' ? b.author.trim() : 'Stride';
  const category = typeof b.category === 'string' ? b.category.trim() : 'Uncategorized';
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  const image = typeof b.image === 'string' ? b.image.trim() : '';
  const imageTitle = typeof b.imageTitle === 'string' ? b.imageTitle.trim() || null : null;

  if (!title || !excerpt) {
    return NextResponse.json(
      { error: 'Title and excerpt are required.' },
      { status: 400 }
    );
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Insights are not available without a database.' },
        { status: 503 }
      );
    }

    const baseSlug = insightSlugBase(title);
    const slug = await ensureUniqueSlug(baseSlug, async (s) => {
      const existing = await prisma.insight.findUnique({ where: { slug: s } });
      return !!existing;
    });
    const internalUrl = `/insights/${slug}`;

    const insight = await prisma.insight.create({
      data: {
        slug,
        title,
        excerpt,
        body: articleBody ?? undefined,
        author: author || 'Stride',
        category: category || 'Uncategorized',
        url: url?.trim() ? url : internalUrl,
        image: image || '/images/insights/featured-images/placeholder.png',
        imageTitle: imageTitle ?? undefined,
      },
    });

    return NextResponse.json({
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
    });
  } catch (e) {
    console.error('Insights POST error:', e);
    return NextResponse.json(
      { error: 'Failed to create insight.' },
      { status: 500 }
    );
  }
}
