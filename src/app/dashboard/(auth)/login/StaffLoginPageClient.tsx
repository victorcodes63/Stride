'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { brandConfig } from '@/lib/brand.config';
import { usePublicBrand } from '@/components/BrandProvider';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getMetadataTitle } from '@/lib/brand';
import { OAuthEmailDivider, OAuthProviderButtons } from '@/components/auth/OAuthProviderButtons';
import { LoginCard, LoginPageShell } from '@/components/auth/LoginPageShell';
import type { LoginPublicConfig } from '@/lib/login-public-config';

const STAFF_LOGIN_PATH = '/api/auth/login';

type StaffWelcomeCopy = {
 welcomeTitle: string;
 welcomeSubtitle: string;
 emailLoginEnabled: boolean;
};

type StaffLoginContentProps = {
 loginConfig: LoginPublicConfig;
 initialError: string;
 welcomeCopy: StaffWelcomeCopy;
};

export function StaffLoginContent({ loginConfig, initialError, welcomeCopy }: StaffLoginContentProps) {
 const { privacyPolicyUrl, termsUrl, defaultLandingPath } = usePublicBrand();
 const router = useRouter();
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [error, setError] = useState(initialError);
 const [loading, setLoading] = useState(false);
 const [mfaCode, setMfaCode] = useState('');
 const [mfaChallenge, setMfaChallenge] = useState('');
 const [showOAuth, setShowOAuth] = useState(false);
 const emailLoginEnabled = welcomeCopy.emailLoginEnabled;
 const [rememberMe, setRememberMe] = useState(true);

 useEffect(() => {
 document.title = getMetadataTitle('Login');
 }, []);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 const res = await fetch(STAFF_LOGIN_PATH, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email, password }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(data.error || 'Invalid email or password.');
 setLoading(false);
 return;
 }
 if (data?.mfaRequired && typeof data?.challenge === 'string') {
 setMfaChallenge(data.challenge);
 setError('');
 setLoading(false);
 return;
 }
 router.push(defaultLandingPath || '/dashboard');
 router.refresh();
 } catch {
 setError('Something went wrong. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 const handleMfaSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 const res = await fetch('/api/auth/mfa/verify-login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ challenge: mfaChallenge, code: mfaCode }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(data.error || 'Invalid MFA code.');
 return;
 }
 router.push(defaultLandingPath || '/dashboard');
 router.refresh();
 } catch {
 setError('Unable to verify MFA code. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <LoginPageShell
 audience="staff"
 welcomeTitle={welcomeCopy.welcomeTitle}
 welcomeSubtitle={welcomeCopy.welcomeSubtitle}
 footer={
 <footer className="border-t border-white/10 px-5 py-4 text-center lg:hidden">
 <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[#fbf8f4]/50">
 <Link href="/careers" className="hover:text-[#fbf8f4]">Careers</Link>
 <Link href={privacyPolicyUrl || '/privacy'} className="hover:text-[#fbf8f4]">Privacy</Link>
 <Link href={termsUrl || '/terms'} className="hover:text-[#fbf8f4]">Terms</Link>
 </nav>
 <p className="mx-auto mt-2 max-w-xs text-pretty text-xs leading-relaxed text-[#fbf8f4]/45" suppressHydrationWarning>
 © {new Date().getFullYear()} {brandConfig.productName}
 </p>
 </footer>
 }
 >
 <LoginCard
 footer={
 <p className="text-center text-[0.8125rem] dash-auth-muted">
          Looking for employee self-service?{' '}
 <Link href="/ess/login" className="dash-auth-link">
            Open the ESS portal
 </Link>
 </p>
 }
 >
 <h2 className="dash-auth-title">
 Sign in to your account
 </h2>

 {error && (
 <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] leading-snug text-red-700">
 <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
 <span>{error}</span>
 </div>
 )}

 {emailLoginEnabled ? (
 <form
 onSubmit={mfaChallenge ? handleMfaSubmit : handleSubmit}
 className={`space-y-4 ${error ? 'mt-4' : 'mt-6'}`}
 >
 <div>
 <label htmlFor="email" className="mb-1.5 block dash-auth-label">
 Email
 </label>
 <input
 id="email"
 type="email"
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="dash-auth-input"
 placeholder={loginConfig.emailPlaceholder}
 />
 </div>

 {!mfaChallenge ? (
 <div>
 <div className="mb-1.5 flex items-center justify-between">
 <label htmlFor="password" className="dash-auth-label">
 Password
 </label>
 <Link
 href="/dashboard/forgot-password"
 className="dash-auth-link text-[0.8125rem]"
 >
 Forgot?
 </Link>
 </div>
 <div className="relative">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 autoComplete="current-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="dash-auth-input pr-9"
 placeholder="••••••••"
 />
 <button
 type="button"
 onClick={() => setShowPassword((s) => !s)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 dash-auth-muted transition-colors hover:text-[var(--dash-text-strong)]"
 aria-label={showPassword ? 'Hide password' : 'Show password'}
 >
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>
 ) : (
 <div>
 <label htmlFor="mfaCode" className="mb-1.5 block dash-auth-label">
 Authentication code
 </label>
 <input
 id="mfaCode"
 type="text"
 inputMode="numeric"
 autoComplete="one-time-code"
 value={mfaCode}
 onChange={(e) => setMfaCode(e.target.value)}
 required
 className="dash-auth-input"
 placeholder="123456"
 />
 </div>
 )}

 {!mfaChallenge && (
 <label className="flex cursor-pointer select-none items-center gap-2">
 <input
 type="checkbox"
 checked={rememberMe}
 onChange={(e) => setRememberMe(e.target.checked)}
 className="dash-auth-checkbox focus:ring-2 focus:ring-[var(--dash-focus-ring)] focus:ring-offset-0"
 />
 <span className="text-[0.8125rem] dash-auth-body">Remember me</span>
 </label>
 )}

 <button
 type="submit"
 disabled={loading}
 className="dash-auth-submit"
 >
 {loading ? (
 <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
 ) : mfaChallenge ? (
 'Verify'
 ) : (
 'Sign in'
 )}
 </button>
 </form>
 ) : null}

 <OAuthEmailDivider />

 <OAuthProviderButtons onError={setError} onVisibleChange={setShowOAuth} />
 </LoginCard>
 </LoginPageShell>
 );
}

export function StaffLoginWithSearchParams({
 loginConfig,
 welcomeCopy,
}: {
 loginConfig: LoginPublicConfig;
 welcomeCopy: StaffWelcomeCopy;
}) {
 const searchParams = useSearchParams();
 const oauthError = searchParams.get('error');
 let initialError = '';
 if (oauthError === 'domain') initialError = 'Use your organization-issued work account (Microsoft or Google) to sign in.';
 else if (oauthError === 'no_account') initialError = 'No active staff account exists for this email. Ask an admin to add you.';
 else if (oauthError === 'inactive') initialError = 'Your staff account is inactive. Contact an administrator.';
 else if (oauthError === 'oauth') initialError = 'Sign-in with Microsoft or Google failed. Please try again.';
 else if (oauthError === 'oauth_disabled') initialError = 'That sign-in method is disabled for this organisation.';
 return <StaffLoginContent loginConfig={loginConfig} initialError={initialError} welcomeCopy={welcomeCopy} />;
}
