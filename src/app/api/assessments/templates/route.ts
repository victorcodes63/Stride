import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const templates = await ctx.run((tx) =>
      tx.assessmentTemplate.findMany({
        where: ctx.where({ isActive: true }),
        include: {
          questions: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { jobAssignments: true } },
        },
        orderBy: { name: 'asc' },
      }),
    );

    return NextResponse.json(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        timeLimitMinutes: t.timeLimitMinutes,
        questionCount: t.questions.length,
        jobAssignmentCount: t._count.jobAssignments,
        questions: t.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          maxPoints: q.maxPoints,
          orderIndex: q.orderIndex,
        })),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });

    const description = typeof body.description === 'string' ? body.description.trim() || null : null;
    const timeLimitMinutes =
      typeof body.timeLimitMinutes === 'number' ? Math.max(5, Math.min(body.timeLimitMinutes, 180)) : 30;

    const questions = Array.isArray(body.questions) ? body.questions : [];
    const template = await ctx.run((tx) =>
      tx.assessmentTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          description,
          timeLimitMinutes,
          questions: {
            create: questions.map((raw, index) => {
              const q = raw as Record<string, unknown>;
              const type = q.type === 'numeric' || q.type === 'file' ? q.type : 'mcq';
              return {
                organizationId: ctx.organizationId,
                type,
                prompt: typeof q.prompt === 'string' ? q.prompt.trim() : `Question ${index + 1}`,
                options: q.options ?? null,
                correctAnswer: q.correctAnswer ?? null,
                maxPoints: typeof q.maxPoints === 'number' ? q.maxPoints : 1,
                orderIndex: index,
              };
            }),
          },
        },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      }),
    );

    return NextResponse.json(template, { status: 201 });
  });
}
