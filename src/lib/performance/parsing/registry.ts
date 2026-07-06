import type { JdParserMode } from '@prisma/client';

import type { JdParseContext, JdParseResult, JdParseSource } from '@/lib/performance/parsing/jd-parser-provider';
import { byoJdParserProvider } from '@/lib/performance/parsing/byo-parser';
import { strideJdParserProvider } from '@/lib/performance/parsing/stride-parser';

const PROVIDERS = [strideJdParserProvider, byoJdParserProvider] as const;

export function getJdParserProvider(id: string) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function listJdParserProviders() {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, usesExternalAi: p.usesExternalAi }));
}

export async function parseJobDescriptionDraft(
  mode: JdParserMode,
  source: JdParseSource,
  ctx: Omit<JdParseContext, 'providerId'>,
): Promise<JdParseResult> {
  if (mode === 'manual') {
    return {
      ok: false,
      error: 'Manual JD mode does not use parsers — use the structured editor. No document data is sent anywhere.',
    };
  }

  const providerId = mode === 'stride' ? 'stride' : 'byo';
  const provider = getJdParserProvider(providerId);
  if (!provider) {
    return { ok: false, error: `No parser registered for mode "${mode}"` };
  }

  return provider.parse(source, { ...ctx, providerId });
}
