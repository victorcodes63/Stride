import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { decryptCredentials } from '@/lib/assessments/crypto';
import { getProviderAdapter } from '@/lib/assessments/providers/registry';
import { ProviderError, type ProviderContext } from '@/lib/assessments/providers/types';

function toContext(c: { baseUrl: string | null; credentialsCipher: string; webhookSecret: string | null }): ProviderContext {
  return { baseUrl: c.baseUrl, credentials: decryptCredentials(c.credentialsCipher), webhookSecret: c.webhookSecret };
}

/** Fetch the live catalog of assessments from the provider. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const connection = await ctx.run((tx) => tx.assessmentProviderConnection.findFirst({ where: ctx.where({ id }) }));
    if (!connection) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });

    const adapter = getProviderAdapter(connection.provider, toContext(connection));
    try {
      const catalog = await adapter.listCatalog(toContext(connection));
      await ctx.run((tx) => tx.assessmentProviderConnection.update({ where: { id }, data: { lastSyncedAt: new Date() } }));
      return NextResponse.json(catalog);
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 502;
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Catalog fetch failed.' }, { status });
    }
  });
}

/** Import selected catalog items into the org's assignable ExternalAssessment list. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const connection = await ctx.run((tx) => tx.assessmentProviderConnection.findFirst({ where: ctx.where({ id }), select: { id: true, provider: true } }));
    if (!connection) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });

    const body = (await request.json()) as { items?: unknown[] };
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return NextResponse.json({ error: 'No items to import.' }, { status: 400 });

    const imported = await ctx.run(async (tx) => {
      const results = [];
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const externalId = String(item.externalId ?? '');
        if (!externalId) continue;
        const record = await tx.externalAssessment.upsert({
          where: { connectionId_externalId: { connectionId: id, externalId } },
          create: {
            organizationId: ctx.organizationId,
            connectionId: id,
            provider: connection.provider,
            externalId,
            name: String(item.name ?? 'Untitled'),
            description: (item.description as string) ?? null,
            category: (item.category as string) ?? null,
            durationMinutes: item.durationMinutes ? Number(item.durationMinutes) : null,
            dimensions: (item.dimensions ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          update: {
            name: String(item.name ?? 'Untitled'),
            description: (item.description as string) ?? null,
            dimensions: (item.dimensions ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        results.push(record);
      }
      return results;
    });

    await ctx.audit({ action: 'ats.external_assessment.imported', entityType: 'AssessmentProviderConnection', entityId: id, metadata: { count: imported.length } });
    return NextResponse.json({ imported: imported.length, items: imported }, { status: 201 });
  });
}
