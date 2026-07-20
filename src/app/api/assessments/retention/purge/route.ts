import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { purgeExpiredAttempts } from '@/lib/assessments/retention';

/** Governance: purge PII from attempts past their template retention window. Admin only. */
export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      const purged = await purgeExpiredAttempts(ctx.organizationId);
      await ctx.audit({ action: 'ats.assessment.retention_purged', entityType: 'Organization', metadata: { purged } });
      return NextResponse.json({ purged });
    },
    { adminOnly: true },
  );
}
