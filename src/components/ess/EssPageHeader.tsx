'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
};

export function EssPageHeader({ title, subtitle, backHref, action }: Props) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-bold text-[var(--ess-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        ) : null}
        <h1 className="text-2xl font-black tracking-tight text-[var(--ess-text)] sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--ess-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
