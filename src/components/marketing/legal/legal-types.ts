import type { ReactNode } from 'react';

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export type MarketingLegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  /** ISO date string, e.g. 2026-06-27 */
  lastUpdated: string;
  sections: LegalSection[];
};
