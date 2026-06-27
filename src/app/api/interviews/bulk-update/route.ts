import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

/**
 * POST /api/interviews/bulk-update
 * Body: { interviewIds: string[], scheduledAt?: string, durationMinutes?: number, type?: InterviewType, locationOrLink?: string | null, notes?: string | null, status?: InterviewStatus }
 * Updates all given interviews with the same fields. Returns { updated: number }.
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const b = body as {
      interviewIds?: unknown;
      scheduledAt?: string;
      durationMinutes?: number;
      type?: string;
      locationOrLink?: string | null;
      notes?: string | null;
      status?: string;
    };
    const ids = Array.isArray(b.interviewIds)
      ? (b.interviewIds as string[]).filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'interviewIds array is required and must not be empty.' }, { status: 400 });
    }
    const updates: import('@prisma/client').Prisma.InterviewUpdateManyMutationInput = {};
    if (b.scheduledAt !== undefined) {
      const d = new Date(b.scheduledAt);
      if (!Number.isNaN(d.getTime())) updates.scheduledAt = d;
    }
    const VALID_DURATIONS = [30, 45, 60] as const;
    if (b.durationMinutes !== undefined && VALID_DURATIONS.includes(b.durationMinutes as (typeof VALID_DURATIONS)[number])) {
      updates.durationMinutes = b.durationMinutes;
    }
    const VALID_TYPES = ['phone', 'video', 'onsite'] as const;
    if (b.type !== undefined && VALID_TYPES.includes(b.type as (typeof VALID_TYPES)[number])) updates.type = b.type;
    if (b.locationOrLink !== undefined) {
      const loc = typeof b.locationOrLink === 'string' ? b.locationOrLink.trim() : '';
      if (!loc) {
        return NextResponse.json(
          { error: 'locationOrLink is required when updating (e.g. Zoom link or office address).' },
          { status: 400 },
        );
      }
      updates.locationOrLink = loc;
    }
    if (b.notes !== undefined) updates.notes = b.notes ?? null;
    if (b.status !== undefined && ['scheduled', 'completed', 'cancelled'].includes(b.status)) {
      updates.status = b.status as import('@/types/dashboard').InterviewStatus;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
      }
      const result = await ctx.run((tx) =>
        tx.interview.updateMany({
          where: ctx.where({ id: { in: ids } }),
          data: updates,
        }),
      );
      return NextResponse.json({ updated: result.count });
    } catch (e) {
      console.error('POST /api/interviews/bulk-update error:', e);
      return NextResponse.json({ error: 'Failed to update interviews.' }, { status: 500 });
    }
  });
}
