'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

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
      setError('Invalid or missing invite link.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ess/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to set password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--ess-line)] bg-white p-8 shadow-sm">
        <div className="flex items-start gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Password set. You can sign in to the employee portal.</span>
        </div>
        <Link
          href="/ess/login"
          className="mt-6 flex h-11 items-center justify-center rounded-xl bg-[var(--ess-primary)] text-sm font-bold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--ess-line)] bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-[var(--ess-text)]">
        {token ? 'Set your password' : 'Invalid link'}
      </h1>
      {!token ? (
        <p className="mt-3 text-sm text-[var(--ess-muted)]">
          This invite link is invalid or expired. Contact HR for a new invite.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-[var(--ess-text)]">
              New password
            </label>
            <input
              id="password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--ess-line)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-bold text-[var(--ess-text)]">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--ess-line)] px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--ess-primary)] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/ess/login" className="font-semibold text-[var(--ess-primary)]">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function EssResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--ess-bg)] px-4 py-16">
      <Suspense fallback={<div className="text-center text-sm text-[var(--ess-muted)]">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
