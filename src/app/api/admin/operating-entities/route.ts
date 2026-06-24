import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
import {
  buildDefaultOperatingEntitiesSettings,
  isMultiEntityEnvEnabled,
  loadOperatingEntitiesSettings,
  OPERATING_ENTITIES_SETTINGS_KEY,
  sanitizeOperatingEntitiesSettings,
  syncOperatingEntitiesToOutsourcingClients,
  validateOperatingEntitiesPatch,
  type OperatingEntitiesSettings,
} from '@/lib/operating-entities';
import { loadCompanySetupSettings } from '@/lib/company-setup';
import { getWorkspaceDefaults } from '@/lib/deployment-config';

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;

  try {
    const settings = await loadOperatingEntitiesSettings();
    return NextResponse.json({
      ...settings,
      envMultiEntityEnabled: isMultiEntityEnvEnabled(),
      defaults: buildDefaultOperatingEntitiesSettings(
        (await loadCompanySetupSettings()).orgName || getWorkspaceDefaults().name,
      ),
    });
  } catch (e) {
    console.error('GET /api/admin/operating-entities error:', e);
    return NextResponse.json({ error: 'Failed to load operating entities.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const current = await loadOperatingEntitiesSettings();
  const merged = sanitizeOperatingEntitiesSettings({ ...current, ...(body as Partial<OperatingEntitiesSettings>) });

  const validationErrors = validateOperatingEntitiesPatch(merged);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: 'Validation failed.', details: validationErrors }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    await prisma.systemSetting.upsert({
      where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
      update: { value: merged, updatedByUserId: actor?.userId ?? null },
      create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: merged, updatedByUserId: actor?.userId ?? null },
    });

    await syncOperatingEntitiesToOutsourcingClients(prisma, merged);

    await logAuditEvent({
      actor,
      action: 'operating_entities.updated',
      entityType: 'SystemSetting',
      entityId: OPERATING_ENTITIES_SETTINGS_KEY,
      route: '/api/admin/operating-entities',
      metadata: { entityCount: merged.entities.length, defaultEntityId: merged.defaultEntityId },
    });

    return NextResponse.json({
      ...merged,
      envMultiEntityEnabled: isMultiEntityEnvEnabled(),
    });
  } catch (e) {
    console.error('PATCH /api/admin/operating-entities error:', e);
    return NextResponse.json({ error: 'Failed to save operating entities.' }, { status: 500 });
  }
}
