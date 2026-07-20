import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { decryptCredentials } from '@/lib/assessments/crypto';
import { getProviderAdapter } from '@/lib/assessments/providers/registry';
import type { ProviderContext, ProviderWebhookParsed } from '@/lib/assessments/providers/types';
import type { NormalizedResult } from '@/lib/assessments/types';
import { recordUsage } from '@/lib/assessments/usage';
import { signOrgWebhookToken } from '@/lib/assessments/webhook-token';

function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.MPESA_CALLBACK_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!fromEnv) return '';
  return fromEnv.startsWith('http') ? fromEnv.replace(/\/$/, '') : `https://${fromEnv}`;
}

function toContext(connection: {
  baseUrl: string | null;
  credentialsCipher: string;
  webhookSecret: string | null;
}): ProviderContext {
  return {
    baseUrl: connection.baseUrl,
    credentials: decryptCredentials(connection.credentialsCipher),
    webhookSecret: connection.webhookSecret,
  };
}

/** Call the provider to invite the candidate; updates the invite row. */
export async function sendExternalInvite(organizationId: string, inviteId: string): Promise<{ status: string; candidateUrl: string | null }> {
  return withOrgContext(organizationId, async (tx) => {
    const invite = await tx.externalAssessmentInvite.findFirst({
      where: { id: inviteId, organizationId },
      include: {
        connection: true,
        externalAssessment: true,
        application: { include: { candidate: true } },
      },
    });
    if (!invite) throw new Error('Invite not found.');

    const adapter = getProviderAdapter(invite.provider, toContext(invite.connection));
    const ctx = toContext(invite.connection);
    const base = appBaseUrl();
    const orgToken = signOrgWebhookToken(organizationId);
    const callbackUrl = base
      ? `${base}/api/webhooks/assessments/${invite.provider}?t=${orgToken}`
      : '';

    try {
      const result = await adapter.invite(ctx, {
        externalId: invite.externalAssessment.externalId,
        candidate: {
          firstName: invite.application.candidate.firstName,
          lastName: invite.application.candidate.lastName,
          email: invite.application.candidate.email,
        },
        callbackUrl,
        metadata: { inviteId: invite.id, applicationId: invite.applicationId },
      });

      await tx.externalAssessmentInvite.update({
        where: { id: invite.id },
        data: {
          externalInviteId: result.externalInviteId,
          candidateUrl: result.candidateUrl,
          status: result.status === 'error' ? 'error' : 'invited',
          invitedAt: new Date(),
          costCents: result.costCents ?? undefined,
          currency: result.currency ?? undefined,
          rawResult: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await recordUsage(organizationId, {
        type: 'external_invite',
        provider: invite.provider,
        applicationId: invite.applicationId,
        unitCostCents: result.costCents ?? null,
        currency: result.currency,
        tx,
      });
      return { status: 'invited', candidateUrl: result.candidateUrl ?? null };
    } catch (error) {
      await tx.externalAssessmentInvite.update({
        where: { id: invite.id },
        data: {
          status: 'error',
          rawResult: { error: error instanceof Error ? error.message : String(error) } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  });
}

/** Apply a parsed provider result (from webhook or polling) to the matching invite. */
export async function applyExternalResult(
  organizationId: string,
  parsed: ProviderWebhookParsed,
): Promise<boolean> {
  return withOrgContext(organizationId, (tx) => applyExternalResultTx(tx, organizationId, parsed));
}

/** Same as applyExternalResult but reuses an existing tenant transaction (webhooks). */
export async function applyExternalResultTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
  parsed: ProviderWebhookParsed,
): Promise<boolean> {
  if (!parsed.externalInviteId) return false;
  const invite = await tx.externalAssessmentInvite.findFirst({
    where: { organizationId, externalInviteId: parsed.externalInviteId },
    select: { id: true },
  });
  if (!invite) return false;
  return writeResult(tx, invite.id, parsed.status, parsed.rawResult, parsed.normalized);
}

async function writeResult(
  tx: Prisma.TransactionClient,
  inviteId: string,
  status: 'in_progress' | 'completed' | 'error',
  rawResult: Record<string, unknown>,
  normalized: NormalizedResult,
): Promise<boolean> {
  await tx.externalAssessmentInvite.update({
    where: { id: inviteId },
    data: {
      status,
      rawResult: rawResult as Prisma.InputJsonValue,
      normalizedResult: normalized as unknown as Prisma.InputJsonValue,
      scorePercent: normalized.scorePercent ?? undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
    },
  });
  return true;
}
