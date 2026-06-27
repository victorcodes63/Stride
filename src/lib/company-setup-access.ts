import { NextResponse } from 'next/server';
import {
  canAccessCompanySetup,
  companySetupTierLabel,
  type DeploymentTier,
} from '@/lib/deployment-tier';

/** API guard — call after requireAdminActor. */
export function companySetupAccessDeniedResponse(
  tier?: DeploymentTier,
): NextResponse | null {
  if (canAccessCompanySetup(tier)) return null;
  const resolvedTier = tier ?? 'starter';
  return NextResponse.json(
    {
      error: 'Company setup is not available on your plan.',
      code: 'COMPANY_SETUP_TIER',
      message: `Company setup and branding controls are included on Growth and Enterprise plans. This organization is on ${companySetupTierLabel(resolvedTier)} — contact Raven Tech Group to upgrade.`,
    },
    { status: 403 },
  );
}
