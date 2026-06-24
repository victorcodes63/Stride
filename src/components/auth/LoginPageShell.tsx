'use client';

import type { OAuthAudience } from '@/lib/oauth-utils';
import { usePublicBrand } from '@/components/BrandProvider';
import { AuthSplitShell, LoginCard } from '@/components/auth/AuthSplitShell';

type LoginPageShellProps = {
  audience: OAuthAudience;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function LoginPageShell({
  audience,
  welcomeTitle,
  welcomeSubtitle,
  children,
  footer,
}: LoginPageShellProps) {
  const { orgName, tagline } = usePublicBrand();
  const portalLabel = audience === 'ess' ? 'Employee portal' : 'Staff dashboard';

  return (
    <AuthSplitShell
      eyebrow={portalLabel}
      title={welcomeTitle?.trim() || 'Welcome back'}
      subtitle={welcomeSubtitle?.trim() || tagline}
      footer={footer}
    >
      {children}
    </AuthSplitShell>
  );
}

export { LoginCard };
