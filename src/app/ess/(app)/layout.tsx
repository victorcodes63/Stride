import type { Metadata } from 'next';
import { EssShell } from '@/components/ess/EssShell';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { brandThemeStyle } from '@/lib/brand-theme-style';
import { getCompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { getDeploymentTier, getDeploymentFeatureOverrides } from '@/lib/deployment-tier';

/** White-label the browser tab for the employee portal (overrides the root “| Stride”). */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedPublicBrand();
  return {
    title: {
      default: brand.appName,
      template: `%s | ${brand.appName}`,
    },
  };
}

export default async function EssAppLayout({ children }: { children: React.ReactNode }) {
  const publicBrand = await getResolvedPublicBrand();
  const capabilities = getCompanySetupCapabilities({
    tier: getDeploymentTier(),
    features: getDeploymentFeatureOverrides(),
  });
  const themeStyle = brandThemeStyle({
    primaryColor: publicBrand.primaryColor,
    secondaryColor: publicBrand.secondaryColor,
    allowColorScheme: capabilities.canConfigureColorScheme,
  });

  return (
    <EssShell
      brand={{
        orgName: publicBrand.orgName,
      }}
      themeStyle={themeStyle}
    >
      {children}
    </EssShell>
  );
}
