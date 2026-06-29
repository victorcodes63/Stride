import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdminOrganization } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
import type { SystemSettingsPayload } from '@/types/dashboard';
import { withOrgContext } from '@/lib/org-context';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';

const SETTINGS_KEY = 'admin.platform.settings';

const DEFAULT_SETTINGS: SystemSettingsPayload = {
  companyName: 'Stride',
  companyEmail: 'hr@example.com',
  defaultCurrency: 'KES',
  payrollCutoffDay: 25,
  leaveApprovalMode: 'single',
  requireMfaForAdmins: false,
};

function sanitizeSettings(value: unknown): SystemSettingsPayload {
  const raw = (value ?? {}) as Record<string, unknown>;
  const cutoffRaw = Number(raw.payrollCutoffDay);
  const payrollCutoffDay = Number.isFinite(cutoffRaw) ? Math.max(1, Math.min(31, Math.round(cutoffRaw))) : 25;
  const leaveApprovalMode = raw.leaveApprovalMode === 'multi' ? 'multi' : 'single';
  return {
    companyName: typeof raw.companyName === 'string' && raw.companyName.trim() ? raw.companyName.trim() : DEFAULT_SETTINGS.companyName,
    companyEmail:
      typeof raw.companyEmail === 'string' && raw.companyEmail.trim()
        ? raw.companyEmail.trim().toLowerCase()
        : DEFAULT_SETTINGS.companyEmail,
    defaultCurrency:
      typeof raw.defaultCurrency === 'string' && raw.defaultCurrency.trim()
        ? raw.defaultCurrency.trim().toUpperCase()
        : DEFAULT_SETTINGS.defaultCurrency,
    payrollCutoffDay,
    leaveApprovalMode,
    requireMfaForAdmins: Boolean(raw.requireMfaForAdmins),
  };
}

async function loadSettingsForOrg(organizationId: string): Promise<SystemSettingsPayload> {
  return withOrgContext(organizationId, async (tx) => {
    const row = await tx.systemSetting.findUnique({
      where: systemSettingWhere(organizationId, SETTINGS_KEY),
    });
    if (row) return sanitizeSettings(row.value);

    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgName = org?.name?.trim();
    if (!orgName) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings({ ...DEFAULT_SETTINGS, companyName: orgName });
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    return NextResponse.json(await loadSettingsForOrg(auth.organizationId));
  } catch (e) {
    console.error('GET /api/admin/settings error:', e);
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;
  const { actor, organizationId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const settings = sanitizeSettings(body);

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    await withOrgContext(organizationId, (tx) =>
      tx.systemSetting.upsert({
        where: systemSettingWhere(organizationId, SETTINGS_KEY),
        update: {
          value: settings as unknown as Prisma.InputJsonValue,
          updatedByUserId: actor?.userId ?? null,
        },
        create: systemSettingCreate(
          organizationId,
          SETTINGS_KEY,
          settings as unknown as Prisma.InputJsonValue,
          actor?.userId ?? null,
        ),
      }),
    );

    await logAuditEvent({
      actor,
      action: 'settings.updated',
      entityType: 'SystemSetting',
      entityId: SETTINGS_KEY,
      route: '/api/admin/settings',
      metadata: settings,
      organizationId,
    });

    return NextResponse.json(settings);
  } catch (e) {
    console.error('PATCH /api/admin/settings error:', e);
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }
}
