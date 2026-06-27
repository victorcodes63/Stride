'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { LoginCard, LoginPageShell } from '@/components/auth/LoginPageShell';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Invalid or missing reset link.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to reset password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginPageShell
      audience="staff"
      welcomeTitle="Set a new password"
      welcomeSubtitle="Choose a secure password for your Stride staff account."
    >
      <LoginCard>
        <h2 className="dash-auth-title">{token ? 'Choose a new password' : 'Invalid link'}</h2>

        {done ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[0.8125rem] leading-snug text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
              <span>Your password has been updated. You can sign in now.</span>
            </div>
            <Link href="/dashboard/login" className="dash-auth-submit inline-flex w-full justify-center">
              Sign in
            </Link>
          </div>
        ) : !token ? (
          <p className="mt-4 text-[0.8125rem] dash-auth-body">
            This link is invalid or has expired.{' '}
            <Link href="/dashboard/forgot-password" className="dash-auth-link">
              Request a new reset link
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] leading-snug text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <label htmlFor="password" className="mb-1.5 block dash-auth-label">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="dash-auth-input"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block dash-auth-label">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="dash-auth-input"
              />
            </div>
            <button type="submit" disabled={loading} className="dash-auth-submit">
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        {!done && (
          <p className="mt-5 text-center text-[0.8125rem] dash-auth-body">
            <Link href="/dashboard/login" className="dash-auth-link">
              ← Back to sign in
            </Link>
          </p>
        )}
      </LoginCard>
    </LoginPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
