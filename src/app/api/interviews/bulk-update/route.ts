import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { InterviewType, InterviewDurationMinutes, InterviewStatus } from '@/types/dashboard';
import type { Prisma } from '@prisma/client';

const VALID_TYPES: InterviewType[] = ['phone', 'video', 'onsite'];
const VALID_DURATIONS: InterviewDurationMinutes[] = [30, 45, 60];

/**
 * POST /api/interviews/bulk-update
 * Body: { interviewIds: string[], scheduledAt?: string, durationMinutes?: number, type?: InterviewType, locationOrLink?: string | null, notes?: string | null, status?: InterviewStatus }
 * Updates all given interviews with the same fields. Returns { updated: number }.
 */
export async function POST(request: NextRequest) {
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
  const updates: Prisma.InterviewUpdateManyMutationInput = {};
  if (b.scheduledAt !== undefined) {
    const d = new Date(b.scheduledAt);
    if (!Number.isNaN(d.getTime())) updates.scheduledAt = d;
  }
  if (b.durationMinutes !== undefined && VALID_DURATIONS.includes(b.durationMinutes as InterviewDurationMinutes)) {
    updates.durationMinutes = b.durationMinutes;
  }
  if (b.type !== undefined && VALID_TYPES.includes(b.type as InterviewType)) updates.type = b.type;
  if (b.locationOrLink !== undefined) {
    const loc = typeof b.locationOrLink === 'string' ? b.locationOrLink.trim() : '';
    if (!loc) {
      return NextResponse.json({ error: 'locationOrLink is required when updating (e.g. Zoom link or office address).' }, { status: 400 });
    }
    updates.locationOrLink = loc;
  }
  if (b.notes !== undefined) updates.notes = b.notes ?? null;
  if (b.status !== undefined && ['scheduled', 'completed', 'cancelled'].includes(b.status)) {
    updates.status = b.status as InterviewStatus;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const result = await prisma.interview.updateMany({
      where: { id: { in: ids } },
      data: updates,
    });
    return NextResponse.json({ updated: result.count });
  } catch (e) {
    console.error('POST /api/interviews/bulk-update error:', e);
    return NextResponse.json({ error: 'Failed to update interviews.' }, { status: 500 });
  }
}
