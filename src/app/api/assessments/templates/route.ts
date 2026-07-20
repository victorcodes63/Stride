import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { parseTemplateInput, TemplateValidationError } from '@/lib/assessments/template-io';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const templates = await ctx.run((tx) =>
      tx.assessmentTemplate.findMany({
        where: ctx.where({ isActive: true }),
        include: {
          sections: { orderBy: { orderIndex: 'asc' } },
          questions: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { jobAssignments: true, applicationAttempts: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );

    return NextResponse.json(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        kind: t.kind,
        category: t.category,
        timeLimitMinutes: t.timeLimitMinutes,
        passingScorePercent: t.passingScorePercent,
        shuffleSections: t.shuffleSections,
        shuffleQuestions: t.shuffleQuestions,
        negativeMarking: t.negativeMarking,
        showResultsToCandidate: t.showResultsToCandidate,
        requireConsent: t.requireConsent,
        requireWebcam: t.requireWebcam,
        lockdown: t.lockdown,
        retentionDays: t.retentionDays,
        questionCount: t.questions.length,
        jobAssignmentCount: t._count.jobAssignments,
        attemptCount: t._count.applicationAttempts,
        sections: t.sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          orderIndex: s.orderIndex,
          timeLimitMinutes: s.timeLimitMinutes,
          shuffleQuestions: s.shuffleQuestions,
          pickCount: s.pickCount,
        })),
        questions: t.questions.map((q) => ({
          id: q.id,
          sectionId: q.sectionId,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          scoring: q.scoring,
          explanation: q.explanation,
          mediaUrl: q.mediaUrl,
          difficulty: q.difficulty,
          weight: q.weight,
          maxPoints: q.maxPoints,
          required: q.required,
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

    let parsed;
    try {
      parsed = parseTemplateInput((await request.json()) as Record<string, unknown>);
    } catch (e) {
      if (e instanceof TemplateValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const template = await ctx.run(async (tx) => {
      const created = await tx.assessmentTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name: parsed.name,
          description: parsed.description,
          kind: parsed.kind,
          category: parsed.category,
          timeLimitMinutes: parsed.timeLimitMinutes,
          passingScorePercent: parsed.passingScorePercent,
          shuffleSections: parsed.shuffleSections,
          shuffleQuestions: parsed.shuffleQuestions,
          negativeMarking: parsed.negativeMarking,
          showResultsToCandidate: parsed.showResultsToCandidate,
          requireConsent: parsed.requireConsent,
          requireWebcam: parsed.requireWebcam,
          lockdown: parsed.lockdown,
          retentionDays: parsed.retentionDays,
        },
      });

      const sectionIdByKey = new Map<string, string>();
      for (const section of parsed.sections) {
        const s = await tx.assessmentSection.create({
          data: {
            organizationId: ctx.organizationId,
            templateId: created.id,
            title: section.title,
            description: section.description,
            orderIndex: section.orderIndex,
            timeLimitMinutes: section.timeLimitMinutes,
            shuffleQuestions: section.shuffleQuestions,
            pickCount: section.pickCount,
          },
        });
        sectionIdByKey.set(section.clientKey, s.id);
      }

      for (const q of parsed.questions) {
        const sectionId = q.sectionKey ? sectionIdByKey.get(q.sectionKey) ?? null : null;
        await tx.assessmentQuestion.create({
          data: {
            organizationId: ctx.organizationId,
            templateId: created.id,
            sectionId,
            bankItemId: q.bankItemId,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            correctAnswer: q.correctAnswer,
            scoring: q.scoring,
            explanation: q.explanation,
            mediaUrl: q.mediaUrl,
            difficulty: q.difficulty,
            weight: q.weight,
            maxPoints: q.maxPoints,
            required: q.required,
            orderIndex: q.orderIndex,
          } satisfies Prisma.AssessmentQuestionUncheckedCreateInput,
        });
      }

      return tx.assessmentTemplate.findUnique({
        where: { id: created.id },
        include: { sections: true, questions: true },
      });
    });

    await ctx.audit({ action: 'ats.assessment_template.created', entityType: 'AssessmentTemplate', entityId: template?.id });
    return NextResponse.json(template, { status: 201 });
  });
}
