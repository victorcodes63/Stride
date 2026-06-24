'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicDocumentShell } from '@/components/public/PublicDocumentShell';

type InterviewRespondShellProps = {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  done?: { message: string } | null;
  children?: ReactNode;
  footer?: ReactNode;
};

export function InterviewRespondShell({
  title,
  description,
  loading,
  error,
  done,
  children,
  footer,
}: InterviewRespondShellProps) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pub-surface-muted px-5 font-pub">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-pub-border border-t-pub-primary" />
          <p className="text-sm text-pub-ink-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <PublicDocumentShell title="Thank you" description={done.message}>
        <Link href="/careers" className="pub-btn-primary inline-flex w-full justify-center">
          Back to careers
        </Link>
      </PublicDocumentShell>
    );
  }

  if (error && !children) {
    return (
      <PublicDocumentShell title="Invalid link" description={error}>
        <Link href="/careers" className="pub-btn-primary inline-flex w-full justify-center">
          Back to careers
        </Link>
      </PublicDocumentShell>
    );
  }

  return (
    <PublicDocumentShell title={title} description={description}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {children}
      {footer ? <div className="mt-6 border-t border-pub-border pt-4 text-sm text-pub-ink-subtle">{footer}</div> : null}
    </PublicDocumentShell>
  );
}
