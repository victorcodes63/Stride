'use client';

import type { IconProps } from '@phosphor-icons/react';
import type { ComponentType, ReactNode } from 'react';
import { PubFeatureGrid } from '@/components/public/PubDuotoneIcon';

export type PublicLegalSection = {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
};

type PublicLegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: PublicLegalSection[];
  children?: ReactNode;
};

export function PublicLegalPage({
  eyebrow,
  title,
  description,
  sections,
  children,
}: PublicLegalPageProps) {
  return (
    <main className="min-h-screen bg-pub-surface pt-[72px]">
      <section className="border-b border-pub-border bg-pub-surface-muted">
        <div className="mx-auto max-w-[720px] px-5 py-14 sm:px-8 md:py-16">
          <p className="text-sm font-medium text-pub-primary">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-normal tracking-tight text-pub-ink md:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-relaxed text-pub-ink-muted">{description}</p>
        </div>
      </section>

      <section className="border-b border-pub-border py-12 md:py-14">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <PubFeatureGrid items={sections} />
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[720px] px-5 sm:px-8">
          <div className="prose-pub space-y-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
