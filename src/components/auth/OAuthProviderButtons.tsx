'use client';

import { useEffect, useState } from 'react';
import { getOAuthStartPath, type OAuthAudience } from '@/lib/oauth-utils';

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

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path fill="#f25022" d="M1 1h9v9H1z" />
      <path fill="#00a4ef" d="M11 1h9v9h-9z" />
      <path fill="#7fba00" d="M1 11h9v9H1z" />
      <path fill="#ffb900" d="M11 11h9v9h-9z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
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
        onVisibleChange?.(true);
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
