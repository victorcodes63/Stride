import { NextResponse } from 'next/server';
import {
  getEffectiveOAuthProviders,
  loadCompanySetupSettings,
  toPublicCompanySetup,
} from '@/lib/company-setup';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';

export const dynamic = 'force-dynamic';

/** Public branding + login toggles for staff/ESS login pages (no secrets). */
export async function GET() {
  const setup = await loadCompanySetupSettings();
  const brand = await getResolvedPublicBrand();
  return NextResponse.json({
    ...toPublicCompanySetup(setup),
    brand,
    oauth: {
      staff: getEffectiveOAuthProviders('staff', setup).filter((p) => p.enabled),
      ess: getEffectiveOAuthProviders('ess', setup).filter((p) => p.enabled),
    },
  });
}
