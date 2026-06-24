'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import type { LoginPublicConfig } from '@/lib/login-public-config';
import { getOAuthStartPath, type OAuthAudience } from '@/lib/oauth-utils';

function resolveOAuthError(code: string | null): string {
  if (code === 'domain') return 'Use your organisation work email to sign in.';
  if (code === 'no_account') return 'No employee account exists for this email. Contact HR.';
  if (code === 'inactive') return 'Your account is inactive. Contact HR.';
  if (code === 'oauth') return 'Sign-in failed. Please try again.';
  if (code === 'oauth_disabled') return 'That sign-in method is disabled.';
  return '';
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path fill="#f25022" d="M1 1h9v9H1z" />
      <path fill="#00a4ef" d="M11 1h9v9h-9z" />
      <path fill="#7fba00" d="M1 11h9v9H1z" />
      <path fill="#ffb900" d="M11 11h9v9h-9z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type OAuthProviderKey = 'microsoft' | 'google';
type ProviderConfig = { key: OAuthProviderKey; label: string; configured: boolean; startPath: string };

function useOAuthProviders(audience: OAuthAudience) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { key: 'microsoft', label: 'Microsoft', configured: false, startPath: getOAuthStartPath(audience, 'microsoft') },
    { key: 'google', label: 'Google', configured: false, startPath: getOAuthStartPath(audience, 'google') },
  ]);

  useState(() => {
    fetch('/api/config/company-setup')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { oauth?: { ess?: ProviderConfig[] } } | null) => {
        if (!data?.oauth?.ess?.length) return;
        setProviders(data.oauth.ess);
      })
      .catch(() => {});
  });

  return providers;
}

export function EssLoginForm({
  loginConfig,
  welcomeCopy,
}: {
  loginConfig: LoginPublicConfig;
  welcomeCopy: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    portalTitle: string;
    emailLoginEnabled: boolean;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => resolveOAuthError(searchParams.get('error')));
  const emailLoginEnabled = welcomeCopy.emailLoginEnabled;
  const portalTitle = welcomeCopy.portalTitle || 'Employee Self Service';
  const welcomeTitle = welcomeCopy.welcomeTitle;
  const welcomeSubtitle =
    welcomeCopy.welcomeSubtitle ||
    'Access leave, payslips, and personal details.';
  const from = searchParams.get('from') || '/ess';
  const providers = useOAuthProviders('ess');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ess/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Unable to sign in.'); return; }
      router.replace(from);
      router.refresh();
    } catch {
      setError('Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  }

  function handleOAuth(provider: ProviderConfig) {
    if (!provider.configured) {
      setError(`${provider.label} sign-in is not configured yet. Use email and password, or contact HR.`);
      return;
    }
    window.location.href = provider.startPath;
  }

  const inputCls =
    'h-[3.25rem] w-full rounded-[0.875rem] border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/10';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f7fb]">
      {/* ── Hero header ── */}
      <div
        className="relative overflow-hidden px-6 pb-10 pt-[max(env(safe-area-inset-top,0px),2.5rem)]"
        style={{
          background: 'linear-gradient(145deg, #1A1714 0%, #141210 60%, #0A0908 100%)',
        }}
      >
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.06]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-black/[0.08]" aria-hidden="true" />
        <div className="pointer-events-none absolute right-16 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/[0.04]" aria-hidden="true" />

        <div className="relative mx-auto flex max-w-sm flex-col items-center text-center">
          <BrandLogo
            variant="auth"
            priority
            className="h-10 object-contain brightness-0 invert"
          />
          <h1 className="mt-5 text-[1.5rem] font-extrabold leading-tight tracking-tight text-white">
            {welcomeTitle || portalTitle}
          </h1>
          <p className="mt-2 max-w-[260px] text-[0.875rem] leading-relaxed text-white/55">
            {welcomeSubtitle}
          </p>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="relative -mt-4 flex flex-1 flex-col px-4 pb-6">
        <div className="mx-auto w-full max-w-sm">
          <div
            className="rounded-[1.5rem] bg-white p-6"
            style={{
              border: '1px solid rgba(148,163,184,0.2)',
              boxShadow: '0 8px 30px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.03)',
            }}
          >
            {error ? (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-[0.8125rem] leading-snug text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            ) : null}

            {emailLoginEnabled ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="ess-email" className="mb-1.5 block text-[0.8125rem] font-bold text-slate-700">
                    Email
                  </label>
                  <input
                    id="ess-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="ess-password" className="mb-1.5 block text-[0.8125rem] font-bold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="ess-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputCls} pr-12`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors active:bg-slate-100"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="relative flex h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-full text-[0.9375rem] font-bold text-white transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #1A1714, #141210)',
                    boxShadow: '0 10px 28px rgba(29,36,96,0.28)',
                  }}
                >
                  {loading ? (
                    <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            ) : null}

            {/* Divider */}
            {emailLoginEnabled && providers.length > 0 ? (
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                    or continue with
                  </span>
                </div>
              </div>
            ) : null}

            {/* SSO buttons */}
            {providers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {providers.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleOAuth(p)}
                    className="flex h-[3rem] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
                    aria-label={`Continue with ${p.label}`}
                  >
                    {p.key === 'microsoft' ? <MicrosoftIcon /> : <GoogleIcon />}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 text-center">
          <p className="text-[0.8125rem] text-slate-500">
            HR staff?{' '}
            <Link href="/dashboard/login" className="font-semibold text-[#1A1714] underline-offset-2 hover:underline">
              Staff dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
