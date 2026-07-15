'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { MicrosoftIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcons';
import { getOAuthStartPath, type OAuthAudience } from '@/lib/oauth-utils';
import { STRIDE_PALETTE } from '@/lib/stride-palette';

function resolveOAuthError(code: string | null): string {
  if (code === 'domain') return 'Use your organisation work email to sign in.';
  if (code === 'no_account') return 'No employee account exists for this email. Contact HR.';
  if (code === 'inactive') return 'Your account is inactive. Contact HR.';
  if (code === 'oauth') return 'Sign-in failed. Please try again.';
  if (code === 'oauth_disabled') return 'That sign-in method is disabled.';
  return '';
}

type OAuthProviderKey = 'microsoft' | 'google';
type ProviderConfig = { key: OAuthProviderKey; label: string; configured: boolean; startPath: string };

function useOAuthProviders(audience: OAuthAudience) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { key: 'microsoft', label: 'Microsoft', configured: false, startPath: getOAuthStartPath(audience, 'microsoft') },
    { key: 'google', label: 'Google', configured: false, startPath: getOAuthStartPath(audience, 'google') },
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config/company-setup')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { oauth?: { ess?: ProviderConfig[] } } | null) => {
        if (cancelled || !data?.oauth?.ess?.length) return;
        setProviders(data.oauth.ess);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [audience]);

  return providers;
}

/** Login is always light brand — ignore dashboard/html.dark remaps of --sc-paper. */
const LOGIN_SURFACE = {
  colorScheme: 'light' as const,
  background: STRIDE_PALETTE.paper,
  ['--ess-login-coral' as string]: STRIDE_PALETTE.coral,
  ['--ess-login-coral-deep' as string]: STRIDE_PALETTE.coralDeep,
  ['--ess-login-coral-pressed' as string]: STRIDE_PALETTE.coralPressed,
  ['--ess-login-coral-subtle' as string]: STRIDE_PALETTE.coralSubtle,
  ['--ess-login-ink' as string]: STRIDE_PALETTE.ink,
  ['--ess-login-ink-muted' as string]: STRIDE_PALETTE.inkMuted,
  ['--ess-login-ink-subtle' as string]: STRIDE_PALETTE.inkSubtle,
  ['--ess-login-paper' as string]: STRIDE_PALETTE.paper,
  ['--ess-login-paper-2' as string]: STRIDE_PALETTE.paper2,
  ['--ess-login-line' as string]: STRIDE_PALETTE.line,
};

export function EssLoginForm({
  welcomeCopy,
}: {
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
      if (!res.ok) {
        setError(data.error || 'Unable to sign in.');
        return;
      }
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
    'h-[3.25rem] w-full rounded-[0.875rem] border border-[var(--ess-login-line)] bg-[var(--ess-login-paper-2)] px-4 text-base text-[var(--ess-login-ink)] shadow-sm transition-all placeholder:text-[var(--ess-login-ink-subtle)] hover:border-[color-mix(in_srgb,var(--ess-login-coral)_35%,var(--ess-login-line))] focus:border-[var(--ess-login-coral)] focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ess-login-coral)_18%,transparent)]';

  return (
    <div className="ess-login flex min-h-[100dvh] flex-col" style={LOGIN_SURFACE}>
      <div
        className="relative overflow-hidden px-6 pb-12 pt-[max(env(safe-area-inset-top,0px),2.5rem)]"
        style={{
          background:
            'linear-gradient(145deg, var(--ess-login-coral) 0%, var(--ess-login-coral-deep) 55%, var(--ess-login-coral-pressed) 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-14 left-6 h-40 w-40 rounded-full bg-black/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-14 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-white/10"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex max-w-sm flex-col items-center text-center">
          {/* Coral wordmark → white for contrast on brand hero */}
          <BrandLogo
            variant="auth"
            priority
            className="h-9 w-auto object-contain brightness-0 invert"
          />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
            {portalTitle}
          </p>
          <h1 className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-tight text-white">
            {welcomeTitle || 'Welcome to Stride'}
          </h1>
          <p className="mt-2 max-w-[280px] text-[0.875rem] leading-relaxed text-white/85">
            {welcomeSubtitle}
          </p>
        </div>
      </div>

      <div className="relative -mt-5 flex flex-1 flex-col px-4 pb-6">
        <div className="mx-auto w-full max-w-sm">
          <div
            className="rounded-[1.5rem] bg-white p-6"
            style={{
              border: '1px solid color-mix(in srgb, var(--ess-login-ink-subtle) 18%, transparent)',
              boxShadow: '0 12px 36px rgba(26, 23, 20, 0.08), 0 2px 8px rgba(26, 23, 20, 0.04)',
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
                  <label
                    htmlFor="ess-email"
                    className="mb-1.5 block text-[0.8125rem] font-bold text-[var(--ess-login-ink)]"
                  >
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
                  />
                </div>
                <div>
                  <label
                    htmlFor="ess-password"
                    className="mb-1.5 block text-[0.8125rem] font-bold text-[var(--ess-login-ink)]"
                  >
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--ess-login-ink-subtle)] transition-colors active:bg-[var(--ess-login-coral-subtle)]"
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
                    background:
                      'linear-gradient(135deg, var(--ess-login-coral) 0%, var(--ess-login-coral-deep) 100%)',
                    boxShadow: '0 12px 28px color-mix(in srgb, var(--ess-login-coral) 38%, transparent)',
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

            {emailLoginEnabled && providers.length > 0 ? (
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-[var(--ess-login-line)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--ess-login-ink-subtle)]">
                    or continue with
                  </span>
                </div>
              </div>
            ) : null}

            {providers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {providers.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleOAuth(p)}
                    className="flex h-[3rem] items-center justify-center gap-2 rounded-2xl border border-[var(--ess-login-line)] bg-white text-sm font-semibold text-[var(--ess-login-ink)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--ess-login-coral)_40%,var(--ess-login-line))] hover:bg-[var(--ess-login-coral-subtle)] active:scale-[0.97]"
                    aria-label={`Continue with ${p.label}`}
                  >
                    {p.key === 'microsoft' ? <MicrosoftIcon size={18} /> : <GoogleIcon size={18} />}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-8 text-center">
          <p className="text-[0.8125rem] text-[var(--ess-login-ink-muted)]">
            HR staff?{' '}
            <Link
              href="/dashboard/login"
              className="font-semibold text-[var(--ess-login-coral)] underline-offset-2 hover:underline"
            >
              Staff dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
