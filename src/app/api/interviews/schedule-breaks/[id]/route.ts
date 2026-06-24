import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateTimeAsNairobi } from '@/lib/timezone';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const data: {
      scheduledAt?: Date;
      durationMinutes?: number;
      label?: string;
      notes?: string | null;
    } = {};
    if (typeof body.scheduledAt === 'string' && body.scheduledAt.trim()) {
      const d = parseDateTimeAsNairobi(body.scheduledAt.trim());
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid scheduledAt.' }, { status: 400 });
      data.scheduledAt = d;
    }
    if (body.durationMinutes != null) {
      data.durationMinutes = Math.min(180, Math.max(5, parseInt(String(body.durationMinutes), 10) || 15));
    }
    if (typeof body.label === 'string') data.label = body.label.trim().slice(0, 120) || 'Break';
    if (body.notes !== undefined) data.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }
    const b = await prisma.interviewScheduleBreak.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      id: b.id,
      jobId: b.jobId,
      scheduledAt: b.scheduledAt.toISOString(),
      durationMinutes: b.durationMinutes,
      label: b.label,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update break.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 });
    await prisma.interviewScheduleBreak.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete break.' }, { status: 500 });
  }
}
