'use client';

import { useEffect, useState } from 'react';
import { getOAuthStartPath, type OAuthAudience } from '@/lib/oauth-utils';
import { MicrosoftIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcons';

export type OAuthProviderKey = 'microsoft' | 'google';

type ProviderConfig = {
  key: OAuthProviderKey;
  label: string;
  configured: boolean;
  startPath: string;
};

type OAuthProviderButtonsProps = {
  audience?: OAuthAudience;
  onError?: (message: string) => void;
  onVisibleChange?: (visible: boolean) => void;
  className?: string;
};

function fallbackProviders(audience: OAuthAudience): ProviderConfig[] {
  return [
    {
      key: 'microsoft',
      label: 'Microsoft',
      configured: false,
      startPath: getOAuthStartPath(audience, 'microsoft'),
    },
    {
      key: 'google',
      label: 'Google',
      configured: false,
      startPath: getOAuthStartPath(audience, 'google'),
    },
  ];
}

export function OAuthProviderButtons({
  audience = 'staff',
  onError,
  onVisibleChange,
  className = '',
}: OAuthProviderButtonsProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>(() => fallbackProviders(audience));

  useEffect(() => {
    let cancelled = false;
    setProviders(fallbackProviders(audience));
    fetch('/api/config/company-setup')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            oauth?: { staff?: ProviderConfig[]; ess?: ProviderConfig[] };
          } | null,
        ) => {
          if (cancelled || !data?.oauth) return;
          const list = audience === 'ess' ? data.oauth.ess : data.oauth.staff;
          if (list?.length) setProviders(list);
          else setProviders([]);
          onVisibleChange?.((list?.length ?? 0) > 0);
        },
      )
      .catch(() => {
        onVisibleChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, onVisibleChange]);

  const handleSignIn = (provider: ProviderConfig) => {
    if (!provider.configured) {
      const portal = audience === 'ess' ? 'employee portal' : 'staff dashboard';
      onError?.(
        `${provider.label} sign-in is not configured for this organisation yet. Use your email and password below, or ask your HR administrator to enable ${provider.label} SSO for the ${portal}.`,
      );
      return;
    }
    window.location.href = provider.startPath;
  };

  if (providers.length === 0) return null;

  return (
    <div className={`flex w-full flex-col gap-2.5 ${className}`.trim()}>
      {providers.map((provider) => (
        <button
          key={provider.key}
          type="button"
          onClick={() => handleSignIn(provider)}
          className="dash-auth-oauth-btn"
          aria-label={`Continue with ${provider.label}`}
        >
          {provider.key === 'microsoft' ? <MicrosoftIcon /> : <GoogleIcon />}
          <span>Continue with {provider.label}</span>
        </button>
      ))}
    </div>
  );
}

export function OAuthEmailDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="dash-auth-divider-line w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="dash-auth-divider-label px-3 text-xs font-medium uppercase tracking-widest">
          or
        </span>
      </div>
    </div>
  );
}
