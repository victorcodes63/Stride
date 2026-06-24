'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthSplitShell, LoginCard } from '@/components/auth/AuthSplitShell';

export default function ForgotPasswordPage() {
 const [email, setEmail] = useState('');
 const [submitted, setSubmitted] = useState(false);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 await new Promise((r) => setTimeout(r, 800));
 setSubmitted(true);
 } catch {
 setError('Something went wrong. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <AuthSplitShell
 eyebrow="Staff dashboard"
 title="Reset your password"
 subtitle="Enter your work email and we'll send reset instructions for your Stride staff account."
 >
 <LoginCard>
 <h2 className="dash-auth-title">
 Forgot your password?
 </h2>
 <p className="mt-1.5 text-[0.8125rem] dash-auth-body">
 Enter your work email and we&apos;ll send you a link to reset your password.
 </p>

 {submitted ? (
 <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[0.8125rem] leading-snug text-emerald-800">
 <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
 <span>If an account exists for that email, we&apos;ve sent reset instructions. Check your inbox.</span>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="mt-6 space-y-4">
 {error ? (
 <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.8125rem] leading-snug text-red-700">
 <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
 <span>{error}</span>
 </div>
 ) : null}

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
 placeholder="you@company.com"
 />
 </div>

 <button
 type="submit"
 disabled={loading}
 className="dash-auth-submit"
 >
 {loading ? 'Sending…' : 'Send reset link'}
 </button>
 </form>
 )}

 <p className="mt-5 text-center text-[0.8125rem] dash-auth-body">
 <Link href="/dashboard/login" className="dash-auth-link">
 ← Back to sign in
 </Link>
 </p>
 </LoginCard>
 </AuthSplitShell>
 );
}
