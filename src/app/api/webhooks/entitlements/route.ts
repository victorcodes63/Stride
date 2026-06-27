import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { DEPLOYMENT_ENTITLEMENTS_KEY } from '@/lib/entitlements-types';
import { entitlementsSetCookieHeader } from '@/lib/entitlements-cookie';
import { horizontalQuotaForTier } from '@/lib/entitlement-buckets';
import type { ModuleKey } from '@/lib/modules';
import { planIdToTier } from '@/lib/entitlements-resolver';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-membership';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';
import { withOrgContext } from '@/lib/org-context';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from '@/lib/webhook-signing';

export const dynamic = 'force-dynamic';

const ENTITLEMENTS_KEY = 'entitlements';

type WebhookPayload = {
  slug: string;
  organizationId?: string;
  tenantOrgSlug?: string;
  accountStatus: string;
  pastDueSince?: string | null;
  billingEmail?: string | null;
  planId: string;
  seatLimit: number | null;
  periodEnd: string | null;
  modules: Record<string, boolean>;
  features?: Record<string, boolean | number | null>;
  horizontalQuota?: number;
  verticalEnginesAllowed?: boolean;
  syncedAt?: string;
  source?: string;
};

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

async function resolveOrganizationId(data: WebhookPayload): Promise<string | null> {
  if (data.organizationId?.trim()) return data.organizationId.trim();

  const slug = data.tenantOrgSlug?.trim() || data.slug?.trim();
  if (!slug) return null;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  return org?.id ?? null;
}

async function persistEntitlements(
  tx: Prisma.TransactionClient,
  organizationId: string,
  entitlements: DeploymentEntitlements,
  scopedToOrganization: boolean,
): Promise<void> {
  const value = entitlements as unknown as Prisma.InputJsonValue;

  if (scopedToOrganization) {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const prev =
      org?.settings && typeof org.settings === 'object'
        ? (org.settings as Record<string, unknown>)
        : {};

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...prev,
          [ENTITLEMENTS_KEY]: entitlements,
        },
      },
    });
    return;
  }

  await tx.systemSetting.upsert({
    where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, DEPLOYMENT_ENTITLEMENTS_KEY),
    create: systemSettingCreate(DEFAULT_ORGANIZATION_ID, DEPLOYMENT_ENTITLEMENTS_KEY, value),
    update: { value },
  });
}

/** POST — control plane pushes entitlement updates (RAV-16). */
export async function POST(request: NextRequest) {
  const secret = trimEnv('CONTROL_PLANE_WEBHOOK_SECRET');
  if (!secret) {
    return NextResponse.json(
      { error: 'CONTROL_PLANE_WEBHOOK_SECRET is not configured' },
      { status: 503 },
    );
  }

  const raw = await request.text();
  const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER);

  if (!verifyWebhookSignature(secret, raw, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let data: WebhookPayload;
  try {
    data = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const expectedSlug = trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
  if (expectedSlug && data.slug !== expectedSlug && !data.organizationId) {
    return NextResponse.json({ error: 'Slug mismatch' }, { status: 403 });
  }

  const planId = data.planId;
  const tier = planIdToTier(planId);

  const entitlements: DeploymentEntitlements = {
    slug: data.slug,
    accountStatus: data.accountStatus,
    pastDueSince: data.pastDueSince ?? null,
    billingEmail: data.billingEmail ?? null,
    planId,
    seatLimit: data.seatLimit,
    periodEnd: data.periodEnd,
    modules: data.modules as Partial<Record<ModuleKey, boolean>>,
    features: data.features ?? {},
    horizontalQuota: data.horizontalQuota ?? horizontalQuotaForTier(tier),
    verticalEnginesAllowed: data.verticalEnginesAllowed ?? tier !== 'starter',
    syncedAt: data.syncedAt ?? new Date().toISOString(),
  };

  try {
    const resolvedOrganizationId = await resolveOrganizationId(data);
    const organizationId = resolvedOrganizationId ?? DEFAULT_ORGANIZATION_ID;

    await withOrgContext(organizationId, async (tx) => {
      await persistEntitlements(
        tx,
        organizationId,
        entitlements,
        Boolean(resolvedOrganizationId),
      );
    });

    const response = NextResponse.json({
      ok: true,
      slug: entitlements.slug,
      syncedAt: entitlements.syncedAt,
      organizationId: resolvedOrganizationId ?? undefined,
    });
    response.headers.append('Set-Cookie', entitlementsSetCookieHeader(entitlements));
    return response;
  } catch (error) {
    console.error('POST /api/webhooks/entitlements error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to persist entitlements' },
      { status: 500 },
    );
  }
}
