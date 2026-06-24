import { NextResponse } from 'next/server';
import { canAccessCompanySetup, companySetupUpgradeCopy } from '@/lib/deployment-tier';

/** API guard — call after requireAdminActor. */
export function companySetupAccessDeniedResponse(): NextResponse | null {
  if (canAccessCompanySetup()) return null;
  return NextResponse.json(
    {
      error: 'Company setup is not available on your plan.',
      code: 'COMPANY_SETUP_TIER',
      message: companySetupUpgradeCopy(),
    },
    { status: 403 },
  );
}
