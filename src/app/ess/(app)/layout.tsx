import { EssShell } from '@/components/ess/EssShell';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { brandThemeStyle } from '@/lib/brand-theme-style';

export default async function EssAppLayout({ children }: { children: React.ReactNode }) {
  const publicBrand = await getResolvedPublicBrand();
  const themeStyle = brandThemeStyle();

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
