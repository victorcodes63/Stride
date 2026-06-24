'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';

type PublicDocumentShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Token / standalone public flows (interview respond, etc.) */
export function PublicDocumentShell({ title, description, children }: PublicDocumentShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-pub-surface-muted font-pub">
      <header className="border-b border-white/10 bg-pub-ink px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[520px] items-center">
          <Link href="/" className="inline-flex" aria-label="Stride home">
            <StrideWordmarkLockup theme="on-ink" markClassName="h-6" wordClassName="text-lg" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="pub-login-card w-full max-w-[480px]">
          <div className="px-6 py-7 sm:px-7 sm:py-8">
            <h1 className="text-xl font-normal tracking-tight text-pub-ink">{title}</h1>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">{description}</p>
            ) : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
