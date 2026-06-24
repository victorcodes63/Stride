import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { demoEntityNote } from '@/lib/demo-entity-content';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;
    const programs = await prisma.trainingProgram.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(entityScope ? { notes: demoEntityNote(entityScope) } : {}),
      },
      include: {
        enrollments: {
          select: { id: true, enrolleeName: true, status: true, completedAt: true },
        },
        materials: { select: { id: true, title: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { enrollments: true, materials: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      programs: programs.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        provider: p.provider,
        location: p.location,
        isOnline: p.isOnline,
        startDate: p.startDate?.toISOString().split('T')[0] ?? null,
        endDate: p.endDate?.toISOString().split('T')[0] ?? null,
        durationHours: p.durationHours,
        maxParticipants: p.maxParticipants,
        cost: p.cost ? Number(p.cost) : null,
        currency: p.currency,
        status: p.status,
        enrollmentCount: p._count.enrollments,
        completedCount: p.enrollments.filter((e) => e.status === 'completed').length,
        materialCount: p._count.materials,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/training',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load training programs.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, category, provider, location, isOnline, startDate, endDate, durationHours, maxParticipants, cost, currency, status } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }

  try {
    const program = await prisma.trainingProgram.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        provider: provider?.trim() || null,
        location: location?.trim() || null,
        isOnline: isOnline ?? false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        durationHours: durationHours ? Number(durationHours) : null,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        cost: cost ? Number(cost) : null,
        currency: currency || 'KES',
        status: status || 'scheduled',
        createdByUserId: user.id,
      },
    });

    return NextResponse.json({ id: program.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/training',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create training program.' }, { status: 500 });
  }
}
