import { NextRequest, NextResponse } from 'next/server';
import { requireAdminActor } from '@/lib/admin-security';
import { companySetupAccessDeniedResponse } from '@/lib/company-setup-access';
import { logAuditEvent } from '@/lib/audit-events';
import { BrandingUploadError, uploadBrandingImage } from '@/lib/branding-upload';
import {
  companySetupContextLabel,
  companySetupStorageKeyFromRequest,
  loadCompanySetupForStorageKey,
  persistCompanySetupSettings,
  sanitizeCompanySetup,
  toPublicCompanySetup,
} from '@/lib/company-setup';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';

const FIELD_MAP = {
  logo: ['logoSrc', 'logoPngPath'] as const,
  favicon: ['faviconSrc'] as const,
  'careers-hero': ['careersHeroImageUrl'] as const,
} as const;

type UploadKind = keyof typeof FIELD_MAP;

export async function POST(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  const tierDenied = companySetupAccessDeniedResponse();
  if (tierDenied) return tierDenied;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = (form.get('kind') as UploadKind) || 'logo';
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing image file.' }, { status: 400 });
    }
    if (!FIELD_MAP[kind]) {
      return NextResponse.json({ error: 'Invalid upload kind.' }, { status: 400 });
    }

    const uploaded = await uploadBrandingImage(file, kind);
    const storageKey = companySetupStorageKeyFromRequest(request);
    const current = await loadCompanySetupForStorageKey(storageKey);
    const patch: Record<string, string> = {};
    for (const field of FIELD_MAP[kind]) {
      patch[field] = uploaded.path;
    }
    const merged = sanitizeCompanySetup({ ...current, ...patch });

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    await persistCompanySetupSettings(storageKey, merged, actor?.userId ?? null);

    await logAuditEvent({
      actor,
      action: 'company_setup.asset_uploaded',
      entityType: 'SystemSetting',
      entityId: storageKey,
      route: '/api/admin/company-setup/upload',
      metadata: { kind, path: uploaded.path },
    });

    return NextResponse.json({
      ...merged,
      storageKey,
      activeContextLabel: companySetupContextLabel(request.cookies.get(HRIS_ENTITY_COOKIE)?.value ?? null),
      public: toPublicCompanySetup(merged),
      uploadedUrl: uploaded.url,
    });
  } catch (e) {
    if (e instanceof BrandingUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('POST /api/admin/company-setup/upload error:', e);
    return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 });
  }
}
