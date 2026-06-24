import { NextRequest, NextResponse } from 'next/server';

import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { entitlementsSetCookieHeader } from '@/lib/entitlements-cookie';
import { saveDeploymentEntitlements } from '@/lib/entitlements-store';
import { horizontalQuotaForTier } from '@/lib/entitlement-buckets';
import type { ModuleKey } from '@/lib/modules';
import { planIdToTier } from '@/lib/entitlements-resolver';
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from '@/lib/webhook-signing';

export const dynamic = 'force-dynamic';

type WebhookPayload = {
  slug: string;
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
  if (expectedSlug && data.slug !== expectedSlug) {
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

  await saveDeploymentEntitlements(entitlements);

  const response = NextResponse.json({
    ok: true,
    slug: entitlements.slug,
    syncedAt: entitlements.syncedAt,
  });
  response.headers.append('Set-Cookie', entitlementsSetCookieHeader(entitlements));
  return response;
}
