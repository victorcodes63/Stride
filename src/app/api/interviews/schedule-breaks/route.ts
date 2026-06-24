import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseDateTimeAsNairobi } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json([]);
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId')?.trim();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
    }
    const dateFrom = searchParams.get('dateFrom')?.trim();
    const dateTo = searchParams.get('dateTo')?.trim();
    const where: { jobId: string; scheduledAt?: { gte?: Date; lte?: Date } } = { jobId };
    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) where.scheduledAt.gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        where.scheduledAt.lte = d;
      }
    }
    const rows = await prisma.interviewScheduleBreak.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
    return NextResponse.json(
      rows.map((b) => ({
        id: b.id,
        jobId: b.jobId,
        scheduledAt: b.scheduledAt.toISOString(),
        durationMinutes: b.durationMinutes,
        label: b.label,
        notes: b.notes,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }))
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load breaks.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    const scheduledAtRaw = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
    const durationMinutes = Math.min(180, Math.max(5, parseInt(String(body.durationMinutes ?? 15), 10) || 15));
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 120) : 'Break';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;
    if (!jobId || !scheduledAtRaw) {
      return NextResponse.json({ error: 'jobId and scheduledAt are required.' }, { status: 400 });
    }
    const scheduledAt = parseDateTimeAsNairobi(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt.' }, { status: 400 });
    }
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    const b = await prisma.interviewScheduleBreak.create({
      data: { jobId, scheduledAt, durationMinutes, label, notes },
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
    return NextResponse.json({ error: 'Failed to create break.' }, { status: 500 });
  }
}
