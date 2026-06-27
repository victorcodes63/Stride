import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import {
  isMultiEntityEnvEnabled,
  loadOperatingEntitiesSettingsForOrg,
  shouldShowEntitySwitcher,
  toPublicEntities,
} from '@/lib/operating-entities';

export const dynamic = 'force-dynamic';

/** Tenant-scoped entities for dashboard switcher (requires staff session). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const settings = await loadOperatingEntitiesSettingsForOrg(ctx.organizationId);
    const entities = toPublicEntities(settings);
    const showSwitcher = shouldShowEntitySwitcher(settings);

    return NextResponse.json({
      entities,
      defaultEntityId: settings.defaultEntityId,
      multiEntityEnabled: settings.multiEntityEnabled,
      multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
      showSwitcher,
    });
  });
}
