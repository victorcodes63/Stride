import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const source = await ctx.run((tx) =>
      tx.assessmentTemplate.findFirst({
        where: ctx.where({ id }),
        include: { sections: { orderBy: { orderIndex: 'asc' } }, questions: { orderBy: { orderIndex: 'asc' } } },
      }),
    );
    if (!source) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

    const copy = await ctx.run(async (tx) => {
      const created = await tx.assessmentTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name: `${source.name} (copy)`,
          description: source.description,
          kind: source.kind,
          category: source.category,
          timeLimitMinutes: source.timeLimitMinutes,
          passingScorePercent: source.passingScorePercent,
          shuffleSections: source.shuffleSections,
          shuffleQuestions: source.shuffleQuestions,
          negativeMarking: source.negativeMarking,
          showResultsToCandidate: source.showResultsToCandidate,
          requireConsent: source.requireConsent,
          requireWebcam: source.requireWebcam,
          lockdown: source.lockdown,
          retentionDays: source.retentionDays,
        },
      });

      const sectionIdByOld = new Map<string, string>();
      for (const s of source.sections) {
        const ns = await tx.assessmentSection.create({
          data: {
            organizationId: ctx.organizationId,
            templateId: created.id,
            title: s.title,
            description: s.description,
            orderIndex: s.orderIndex,
            timeLimitMinutes: s.timeLimitMinutes,
            shuffleQuestions: s.shuffleQuestions,
            pickCount: s.pickCount,
          },
        });
        sectionIdByOld.set(s.id, ns.id);
      }

      for (const q of source.questions) {
        await tx.assessmentQuestion.create({
          data: {
            organizationId: ctx.organizationId,
            templateId: created.id,
            sectionId: q.sectionId ? sectionIdByOld.get(q.sectionId) ?? null : null,
            bankItemId: q.bankItemId,
            type: q.type,
            prompt: q.prompt,
            options: (q.options ?? undefined) as Prisma.InputJsonValue | undefined,
            correctAnswer: (q.correctAnswer ?? undefined) as Prisma.InputJsonValue | undefined,
            scoring: (q.scoring ?? undefined) as Prisma.InputJsonValue | undefined,
            explanation: q.explanation,
            mediaUrl: q.mediaUrl,
            difficulty: q.difficulty,
            weight: q.weight,
            maxPoints: q.maxPoints,
            required: q.required,
            orderIndex: q.orderIndex,
          },
        });
      }
      return created;
    });

    await ctx.audit({ action: 'ats.assessment_template.duplicated', entityType: 'AssessmentTemplate', entityId: copy.id });
    return NextResponse.json(copy, { status: 201 });
  });
}
