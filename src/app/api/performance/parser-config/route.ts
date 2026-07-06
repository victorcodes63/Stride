import { NextRequest, NextResponse } from 'next/server';

import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const config = await ctx.run((tx) =>
      tx.jdParserConfig.findUnique({ where: { organizationId: ctx.organizationId } }),
    );

    return NextResponse.json({
      config: config
        ? {
            mode: config.mode,
            provider: config.provider,
            hasApiKeyRef: Boolean(config.apiKeyRef),
            consentAt: config.consentAt?.toISOString() ?? null,
            promptTemplate: config.promptTemplate,
            aiEvaluationEnabled: config.aiEvaluationEnabled,
            aiEvaluationConsentAt: config.aiEvaluationConsentAt?.toISOString() ?? null,
          }
        : {
            mode: 'manual',
            provider: null,
            hasApiKeyRef: false,
            consentAt: null,
            promptTemplate: null,
            aiEvaluationEnabled: false,
            aiEvaluationConsentAt: null,
          },
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      const body = (await request.json().catch(() => ({}))) as {
        mode?: string;
        provider?: string | null;
        apiKeyRef?: string | null;
        promptTemplate?: string | null;
        consent?: boolean;
        aiEvaluationEnabled?: boolean;
        aiEvaluationConsent?: boolean;
      };

      const mode = body.mode === 'stride' || body.mode === 'byo' || body.mode === 'manual' ? body.mode : 'manual';
      const aiMode = mode === 'stride' || mode === 'byo';

      if (aiMode && !body.consent) {
        return NextResponse.json(
          { error: 'Explicit consent is required before enabling Stride or BYO JD parsing.' },
          { status: 400 },
        );
      }

      const aiEvalRequested = body.aiEvaluationEnabled === true;
      if (aiEvalRequested && !body.aiEvaluationConsent) {
        return NextResponse.json(
          { error: 'Explicit consent is required before enabling AI evaluation assist.' },
          { status: 400 },
        );
      }

      const config = await ctx.run((tx) =>
        tx.jdParserConfig.upsert({
          where: { organizationId: ctx.organizationId },
          create: {
            organizationId: ctx.organizationId,
            mode,
            provider: body.provider ?? null,
            apiKeyRef: body.apiKeyRef ?? null,
            promptTemplate: body.promptTemplate ?? null,
            consentAt: aiMode ? new Date() : null,
            consentByUserId: aiMode ? ctx.staff.id : null,
            aiEvaluationEnabled: aiEvalRequested,
            aiEvaluationConsentAt: aiEvalRequested ? new Date() : null,
            aiEvaluationConsentByUserId: aiEvalRequested ? ctx.staff.id : null,
          },
          update: {
            mode,
            provider: body.provider ?? null,
            ...(body.apiKeyRef !== undefined ? { apiKeyRef: body.apiKeyRef } : {}),
            ...(body.promptTemplate !== undefined ? { promptTemplate: body.promptTemplate } : {}),
            consentAt: aiMode ? new Date() : null,
            consentByUserId: aiMode ? ctx.staff.id : null,
            ...(body.aiEvaluationEnabled !== undefined
              ? {
                  aiEvaluationEnabled: aiEvalRequested,
                  aiEvaluationConsentAt: aiEvalRequested ? new Date() : null,
                  aiEvaluationConsentByUserId: aiEvalRequested ? ctx.staff.id : null,
                }
              : {}),
          },
        }),
      );

      await ctx.audit({
        action: 'performance.parser_config.updated',
        entityType: 'JdParserConfig',
        entityId: config.id,
        route: 'PATCH /api/performance/parser-config',
        metadata: { mode: config.mode },
      });

      return NextResponse.json({
        config: {
          mode: config.mode,
          provider: config.provider,
          hasApiKeyRef: Boolean(config.apiKeyRef),
          consentAt: config.consentAt?.toISOString() ?? null,
        },
      });
    },
    { adminOnly: true },
  );
}
