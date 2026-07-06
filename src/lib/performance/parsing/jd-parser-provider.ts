import type { JobDescriptionInput } from '@/lib/performance/jd/types';

export type JdParseSource = {
  fileName: string;
  mimeType?: string | null;
  /** Raw text extracted upstream (PDF/docx → text). Never logged externally. */
  text: string;
};

export type JdParseContext = {
  organizationId: string;
  providerId: string;
  /** True when org has explicit AI consent (mode + consentAt). */
  aiConsented: boolean;
  apiKeyRef?: string | null;
  promptTemplate?: string | null;
};

export type JdParseResult =
  | { ok: true; draft: JobDescriptionInput; warnings?: string[] }
  | { ok: false; error: string };

/** Pluggable JD parser — manual path never implements this (editor only). */
export interface JdParserProvider {
  readonly id: string;
  readonly label: string;
  /** Whether this provider may call external AI/services. */
  readonly usesExternalAi: boolean;
  parse(source: JdParseSource, ctx: JdParseContext): Promise<JdParseResult>;
}
