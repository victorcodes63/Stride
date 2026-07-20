import { NextRequest, NextResponse } from 'next/server';
import type { AssessmentProviderKey } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { decryptCredentials } from '@/lib/assessments/crypto';
import { getProviderAdapter, PROVIDER_KEYS } from '@/lib/assessments/providers/registry';
import type { ProviderContext } from '@/lib/assessments/providers/types';
import { verifyOrgWebhookToken } from '@/lib/assessments/webhook-token';
import { applyExternalResultTx } from '@/lib/assessments/external-invites';

/**
 * Inbound provider result webhook. The tenant is resolved from a signed `t` token
 * we embedded in the callback URL at invite time — no cross-tenant DB read needed.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params;
  const provider = providerRaw as AssessmentProviderKey;
  if (!PROVIDER_KEYS.includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get('t') ?? '';
  const organizationId = verifyOrgWebhookToken(token);
  if (!organizationId) {
    return NextResponse.json({ error: 'Invalid webhook token.' }, { status: 401 });
  }

  const rawBody = await request.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const handled = await withOrgContext(organizationId, async (tx) => {
      // Find the connection to build a verification context (webhook secret).
      const connection = await tx.assessmentProviderConnection.findFirst({
        where: { organizationId, provider, isActive: true },
      });
      if (!connection) return false;

      const ctx: ProviderContext = {
        baseUrl: connection.baseUrl,
        credentials: safeDecrypt(connection.credentialsCipher),
        webhookSecret: connection.webhookSecret,
      };
      const adapter = getProviderAdapter(provider, ctx);

      const verified = await adapter.verifyWebhook(ctx, request.headers, rawBody);
      if (!verified) return false;

      const parsed = adapter.parseWebhook(ctx, body);
      if (!parsed) return false;

      return applyExternalResultTx(tx, organizationId, parsed);
    });

    if (!handled) return NextResponse.json({ ok: true, matched: false });
    return NextResponse.json({ ok: true, matched: true });
  } catch (error) {
    console.error('[assessment webhook]', error);
    return NextResponse.json({ ok: true, matched: false });
  }
}

function safeDecrypt(cipher: string): Record<string, unknown> {
  try {
    return decryptCredentials(cipher);
  } catch {
    return {};
  }
}
