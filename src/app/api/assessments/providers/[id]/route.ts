import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { encryptCredentials } from '@/lib/assessments/crypto';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const existing = await ctx.run((tx) => tx.assessmentProviderConnection.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.label === 'string') data.label = body.label.trim();
    if (typeof body.baseUrl === 'string') data.baseUrl = body.baseUrl.trim() || null;
    if (typeof body.webhookSecret === 'string') data.webhookSecret = body.webhookSecret.trim() || null;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.credentials && typeof body.credentials === 'object') {
      data.credentialsCipher = encryptCredentials(body.credentials as Record<string, unknown>);
    }

    const connection = await ctx.run((tx) =>
      tx.assessmentProviderConnection.update({
        where: { id },
        data,
        select: { id: true, provider: true, label: true, baseUrl: true, isActive: true },
      }),
    );
    await ctx.audit({ action: 'ats.assessment_provider.updated', entityType: 'AssessmentProviderConnection', entityId: id });
    return NextResponse.json(connection);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const existing = await ctx.run((tx) => tx.assessmentProviderConnection.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Connection not found.' }, { status: 404 });
    await ctx.run((tx) => tx.assessmentProviderConnection.delete({ where: { id } }));
    await ctx.audit({ action: 'ats.assessment_provider.disconnected', entityType: 'AssessmentProviderConnection', entityId: id });
    return NextResponse.json({ ok: true });
  });
}
