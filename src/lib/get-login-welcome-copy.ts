import { cookies } from 'next/headers';
import { loadCompanySetupSettings, toPublicCompanySetup } from '@/lib/company-setup';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { parseDemoEntitySlug } from '@/lib/demo-entity-slug';
import { isGenericPublicLogin } from '@/lib/marketing-site';
import { resolvePublicBrand } from '@/lib/resolve-public-brand';
import { getCompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { getDeploymentTier, getDeploymentFeatureOverrides } from '@/lib/deployment-tier';

export type LoginWelcomeCopy = {
  staff: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    emailLoginEnabled: boolean;
  };
  ess: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    portalTitle: string;
    emailLoginEnabled: boolean;
  };
};

export async function getLoginWelcomeCopy(): Promise<LoginWelcomeCopy> {
  const cookieStore = await cookies();
  const entitySlug = cookieStore.get(HRIS_ENTITY_COOKIE)?.value ?? null;
  const { contextId } = parseDemoEntitySlug(entitySlug);
  const setup = await loadCompanySetupSettings(contextId);
  const pub = toPublicCompanySetup(setup);
  const allowWhiteLabel = getCompanySetupCapabilities({
    tier: getDeploymentTier(),
    features: getDeploymentFeatureOverrides(),
  }).canConfigureWhiteLabel;
  const brand = resolvePublicBrand(setup, { allowWhiteLabel });
  const productName = brand.appName;
  const genericStaffSubtitle = `Sign in to manage your company or organization on ${productName}.`;

  if (isGenericPublicLogin()) {
    return {
      staff: {
        welcomeTitle: `Welcome to ${productName}`,
        welcomeSubtitle: genericStaffSubtitle,
        emailLoginEnabled: pub.staff.emailLoginEnabled,
      },
      ess: {
        welcomeTitle: `Welcome to ${productName}`,
        welcomeSubtitle: 'Sign in to your employee portal.',
        portalTitle: pub.ess.portalTitle || 'Employee portal',
        emailLoginEnabled: pub.ess.emailLoginEnabled,
      },
    };
  }

  return {
    staff: {
      welcomeTitle: `Welcome to ${productName}`,
      welcomeSubtitle: genericStaffSubtitle,
      emailLoginEnabled: pub.staff.emailLoginEnabled,
    },
    ess: {
      welcomeTitle: `Welcome to ${productName}`,
      welcomeSubtitle:
        pub.ess.welcomeSubtitle.trim() || `Sign in to ${brand.essPortalTitle}`,
      portalTitle: pub.ess.portalTitle,
      emailLoginEnabled: pub.ess.emailLoginEnabled,
    },
  };
}
