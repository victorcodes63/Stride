import { NextRequest, NextResponse } from 'next/server';
import type { AssessmentDifficulty, AssessmentQuestionType, Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { ALL_QUESTION_TYPES } from '@/lib/assessments/types';

const DIFFICULTIES: AssessmentDifficulty[] = ['easy', 'medium', 'hard'];

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('q');

    const where: Prisma.QuestionBankItemWhereInput = {
      organizationId: ctx.organizationId,
      ...(category ? { category } : {}),
      ...(search ? { prompt: { contains: search, mode: 'insensitive' } } : {}),
    };
    const items = await ctx.run((tx) =>
      tx.questionBankItem.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 }),
    );
    return NextResponse.json(items);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = (await request.json()) as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return NextResponse.json({ error: 'prompt is required.' }, { status: 400 });

    const typeRaw = body.type as AssessmentQuestionType;
    const type = ALL_QUESTION_TYPES.includes(typeRaw) ? typeRaw : 'mcq';
    const difficultyRaw = body.difficulty as AssessmentDifficulty;
    const difficulty = DIFFICULTIES.includes(difficultyRaw) ? difficultyRaw : 'medium';

    const item = await ctx.run((tx) =>
      tx.questionBankItem.create({
        data: {
          organizationId: ctx.organizationId,
          type,
          prompt,
          options: (body.options ?? undefined) as Prisma.InputJsonValue | undefined,
          correctAnswer: (body.correctAnswer ?? undefined) as Prisma.InputJsonValue | undefined,
          scoring: (body.scoring ?? undefined) as Prisma.InputJsonValue | undefined,
          explanation: typeof body.explanation === 'string' ? body.explanation.trim() || null : null,
          mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() || null : null,
          difficulty,
          defaultPoints: typeof body.defaultPoints === 'number' ? Math.max(0, Math.trunc(body.defaultPoints)) : 1,
          category: typeof body.category === 'string' ? body.category.trim() || null : null,
          tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)).slice(0, 20) : [],
        },
      }),
    );
    await ctx.audit({ action: 'ats.question_bank.created', entityType: 'QuestionBankItem', entityId: item.id });
    return NextResponse.json(item, { status: 201 });
  });
}
