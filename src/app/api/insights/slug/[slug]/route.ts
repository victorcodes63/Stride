import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** GET: fetch single insight by slug (public, for /insights/[slug] page). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug?.trim()) {
    return NextResponse.json({ error: 'Slug required' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    const insight = await prisma.insight.findUnique({
      where: { slug: slug.trim() },
    });
    if (!insight) {
      return NextResponse.json({ error: 'Insight not found.' }, { status: 404 });
    }
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
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load insight.' }, { status: 500 });
  }
}
