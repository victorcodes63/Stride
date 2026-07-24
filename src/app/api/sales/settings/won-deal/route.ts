import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import {
  DEFAULT_WON_DEAL_SETTINGS,
  loadWonDealSettings,
  saveWonDealSettings,
  type WonDealAutomationSettings,
} from '@/lib/sales/won-deal-settings';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET /api/sales/settings/won-deal — org won-deal automation toggles (B4). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const settings = await ctx.run((tx) => loadWonDealSettings(tx, ctx.organizationId));
      const modules = getEffectiveModulesFromRequest(request);
      return NextResponse.json({
        settings,
        defaults: DEFAULT_WON_DEAL_SETTINGS,
        fleetLicensed: modules.fleet === true,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/settings/won-deal',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 });
    }
  });
}

/** PATCH /api/sales/settings/won-deal — update toggles. */
export async function PATCH(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Partial<WonDealAutomationSettings>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const settings = await ctx.run(async (tx) => {
        const saved = await saveWonDealSettings(tx, ctx.organizationId, body, ctx.staff.id);
        await tx.auditEvent.create({
          data: {
            organizationId: ctx.organizationId,
            actorUserId: ctx.staff.id,
            actorEmail: ctx.staff.email,
            action: 'sales.settings.won_deal_updated',
            entityType: 'SystemSetting',
            entityId: null,
            route: '/api/sales/settings/won-deal',
            metadata: { settings: saved },
          },
        });
        return saved;
      });
      const modules = getEffectiveModulesFromRequest(request);
      return NextResponse.json({
        settings,
        fleetLicensed: modules.fleet === true,
      });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/settings/won-deal',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
    }
  });
}
