import { NextResponse } from 'next/server';
import {
  isMultiEntityEnvEnabled,
  loadOperatingEntitiesSettings,
  shouldShowEntitySwitcher,
  toPublicEntities,
} from '@/lib/operating-entities';

export const dynamic = 'force-dynamic';

/** Public read — active entities for dashboard switcher (no secrets). */
export async function GET() {
  const settings = await loadOperatingEntitiesSettings();
  const entities = toPublicEntities(settings);
  const showSwitcher = shouldShowEntitySwitcher(settings);

  return NextResponse.json({
    entities,
    defaultEntityId: settings.defaultEntityId,
    multiEntityEnabled: settings.multiEntityEnabled,
    multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
    showSwitcher,
  });
}
