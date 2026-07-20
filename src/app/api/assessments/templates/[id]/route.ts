import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { parseTemplateInput, TemplateValidationError } from '@/lib/assessments/template-io';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const template = await ctx.run((tx) =>
      tx.assessmentTemplate.findFirst({
        where: ctx.where({ id }),
        include: {
          sections: { orderBy: { orderIndex: 'asc' } },
          questions: { orderBy: { orderIndex: 'asc' } },
        },
      }),
    );
    if (!template) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    return NextResponse.json(template);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let parsed;
    try {
      parsed = parseTemplateInput((await request.json()) as Record<string, unknown>);
    } catch (e) {
      if (e instanceof TemplateValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const existing = await ctx.run((tx) => tx.assessmentTemplate.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

    const template = await ctx.run(async (tx) => {
      await tx.assessmentTemplate.update({
        where: { id },
        data: {
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

      // Replace sections + questions (simplest correct approach for a full save).
      await tx.assessmentQuestion.deleteMany({ where: { templateId: id } });
      await tx.assessmentSection.deleteMany({ where: { templateId: id } });

      const sectionIdByKey = new Map<string, string>();
      for (const section of parsed.sections) {
        const s = await tx.assessmentSection.create({
          data: {
            organizationId: ctx.organizationId,
            templateId: id,
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
            templateId: id,
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
        where: { id },
        include: { sections: true, questions: true },
      });
    });

    await ctx.audit({ action: 'ats.assessment_template.updated', entityType: 'AssessmentTemplate', entityId: id });
    return NextResponse.json(template);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const existing = await ctx.run((tx) => tx.assessmentTemplate.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

    // Soft delete to preserve historical attempts/scores.
    await ctx.run((tx) => tx.assessmentTemplate.update({ where: { id }, data: { isActive: false } }));
    await ctx.audit({ action: 'ats.assessment_template.archived', entityType: 'AssessmentTemplate', entityId: id });
    return NextResponse.json({ ok: true });
  });
}
