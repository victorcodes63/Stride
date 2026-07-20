import { NextRequest, NextResponse } from 'next/server';
import type { AssessmentProviderKey } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { PROVIDER_KEYS } from '@/lib/assessments/providers/registry';
import { credentialCryptoConfigured, CredentialCryptoError, encryptCredentials } from '@/lib/assessments/crypto';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const connections = await ctx.run((tx) =>
      tx.assessmentProviderConnection.findMany({
        where: ctx.where(),
        select: {
          id: true,
          provider: true,
          label: true,
          baseUrl: true,
          isActive: true,
          lastSyncedAt: true,
          createdAt: true,
          _count: { select: { externalAssessments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
    // Never return credential ciphertext to the client.
    return NextResponse.json(
      connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        label: c.label,
        baseUrl: c.baseUrl,
        isActive: c.isActive,
        lastSyncedAt: c.lastSyncedAt,
        assessmentCount: c._count.externalAssessments,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!credentialCryptoConfigured()) {
      return NextResponse.json(
        { error: 'Credential storage is not configured. Set CREDENTIALS_ENC_KEY to connect providers.' },
        { status: 503 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const provider = body.provider as AssessmentProviderKey;
    if (!PROVIDER_KEYS.includes(provider)) {
      return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });
    }
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return NextResponse.json({ error: 'label is required.' }, { status: 400 });

    const credentials = (body.credentials ?? {}) as Record<string, unknown>;
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() || null : null;
    const webhookSecret = typeof body.webhookSecret === 'string' ? body.webhookSecret.trim() || null : null;

    let credentialsCipher: string;
    try {
      credentialsCipher = encryptCredentials(credentials);
    } catch (e) {
      if (e instanceof CredentialCryptoError) return NextResponse.json({ error: e.message }, { status: 503 });
      throw e;
    }

    const connection = await ctx.run((tx) =>
      tx.assessmentProviderConnection.create({
        data: {
          organizationId: ctx.organizationId,
          provider,
          label,
          baseUrl,
          webhookSecret,
          credentialsCipher,
          createdByUserId: ctx.staff.id,
        },
        select: { id: true, provider: true, label: true, baseUrl: true, isActive: true },
      }),
    );
    await ctx.audit({ action: 'ats.assessment_provider.connected', entityType: 'AssessmentProviderConnection', entityId: connection.id, metadata: { provider } });
    return NextResponse.json(connection, { status: 201 });
  });
}
