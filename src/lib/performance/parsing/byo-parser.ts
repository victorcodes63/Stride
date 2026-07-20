import type { JdParserProvider } from '@/lib/performance/parsing/jd-parser-provider';
import { parseStructuredJdText } from '@/lib/performance/parsing/structured-text-parser';

/** BYO AI parser — calls customer-configured endpoint only when consented; never ships data without opt-in. */
export const byoJdParserProvider: JdParserProvider = {
  id: 'byo',
  label: 'Bring your own AI parser',
  usesExternalAi: true,

  async parse(source, ctx) {
    if (!ctx.aiConsented) {
      return {
        ok: false,
        error: 'BYO JD parser requires explicit org consent and provider configuration before any document is sent externally.',
      };
    }

    if (!ctx.apiKeyRef || !ctx.providerId) {
      return {
        ok: false,
        error: 'Configure BYO provider and encrypted API key reference in Company Setup before parsing.',
      };
    }

    if (process.env.PERF_BYO_JD_PARSER_DRY_RUN === '1') {
      return parseStructuredJdText(source);
    }

    return {
      ok: false,
      error:
        'BYO JD parser endpoint integration is not enabled in this deployment. Use manual entry or PERF_BYO_JD_PARSER_DRY_RUN=1 for local dry-run.',
    };
  },
};
