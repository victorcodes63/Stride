import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/interviews/bulk-delete
 * Body: { interviewIds: string[] }
 * Deletes all given interviews. Returns { deleted: number }.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as { interviewIds?: unknown };
  const ids = Array.isArray(b.interviewIds)
    ? (b.interviewIds as string[]).filter((id) => typeof id === 'string' && id.trim().length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'interviewIds array is required and must not be empty.' }, { status: 400 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const result = await prisma.interview.deleteMany({
      where: { id: { in: ids } },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    console.error('POST /api/interviews/bulk-delete error:', e);
    return NextResponse.json({ error: 'Failed to delete interviews.' }, { status: 500 });
  }
}
