import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { demoEntityNote } from '@/lib/demo-entity-content';
import type { TrainingProgram } from '@prisma/client';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import { mapProgramSummary } from '@/lib/training/service';
import type { TrainingProgramInput, TrainingStatus } from '@/lib/training/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
      const q = request.nextUrl.searchParams.get('q')?.trim() || undefined;
      const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
      const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;
      const programs = await ctx.run((tx) =>
        tx.trainingProgram.findMany({
          where: {
            ...ctx.where(),
            ...(status ? { status: status as TrainingStatus } : {}),
            ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q, mode: 'insensitive' } },
                    { provider: { contains: q, mode: 'insensitive' } },
                    { category: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
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
        }),
      );

      return NextResponse.json({
        programs: programs.map(mapProgramSummary),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/training',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load training programs.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Partial<TrainingProgramInput>;
    try {
      body = (await request.json()) as Partial<TrainingProgramInput>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, description, category, provider, location, isOnline, startDate, endDate, durationHours, maxParticipants, cost, currency, status, notes } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    try {
      const program = await withTenantAudit<TrainingProgram>(
        ctx,
        {
          action: 'training.program.created',
          entityType: 'TrainingProgram',
          route: 'POST /api/training',
          entityIdFromResult: (p) => p.id,
        },
        (tx) =>
          tx.trainingProgram.create({
            data: {
              organizationId: ctx.organizationId,
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
              notes: notes?.trim() || null,
              createdByUserId: ctx.staff.id,
            },
          }),
      );

      return NextResponse.json({ id: program.id }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/training',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create training program.' }, { status: 500 });
    }
  });
}
