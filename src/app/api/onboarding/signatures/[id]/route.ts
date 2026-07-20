import { NextRequest, NextResponse } from 'next/server';
import { OnboardingSignatureStatus } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Signature admin requires HR admin privileges.');
    }

    const signature = await ctx.run((tx) =>
      tx.onboardingSignatureRequest.findFirst({
        where: ctx.where({ id }),
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          essPortalUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          task: { select: { id: true, title: true, status: true, workflowId: true } },
        },
      }),
    );
    if (!signature) return NextResponse.json({ error: 'Signature request not found' }, { status: 404 });
    return NextResponse.json(signature);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Signature admin requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === 'string' ? body.action : null;
    if (action !== 'void' && action !== 'resend') {
      return NextResponse.json({ error: "action must be 'void' or 'resend'." }, { status: 400 });
    }

    const result = await ctx.run(async (tx) => {
      const existing = await tx.onboardingSignatureRequest.findFirst({
        where: ctx.where({ id }),
        select: { id: true, status: true },
      });
      if (!existing) return null;

      if (existing.status === OnboardingSignatureStatus.SIGNED) {
        return { error: 'A signed request cannot be changed.' as const };
      }

      if (action === 'void') {
        return {
          updated: await tx.onboardingSignatureRequest.update({
            where: { id },
            data: {
              status: OnboardingSignatureStatus.VOIDED,
              declineReason: typeof body?.reason === 'string' ? body.reason : undefined,
            },
          }),
        };
      }

      // resend: reset a declined/voided/pending request back to PENDING for a fresh attempt.
      return {
        updated: await tx.onboardingSignatureRequest.update({
          where: { id },
          data: {
            status: OnboardingSignatureStatus.PENDING,
            declineReason: null,
            signerName: null,
            signatureImagePath: null,
            signedDocumentPath: null,
            signedAt: null,
            ipAddress: null,
            userAgent: null,
          },
        }),
      };
    });

    if (!result) return NextResponse.json({ error: 'Signature request not found' }, { status: 404 });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });

    await ctx.audit({
      action: `onboarding.signature.${action}`,
      entityType: 'OnboardingSignatureRequest',
      entityId: id,
      route: 'PUT /api/onboarding/signatures/[id]',
    });

    return NextResponse.json(result.updated);
  });
}
