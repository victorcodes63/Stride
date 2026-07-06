import type { JdParserProvider } from '@/lib/performance/parsing/jd-parser-provider';
import { parseStructuredJdText } from '@/lib/performance/parsing/structured-text-parser';

/** Stride-provided parser — external LLM path gated by org consent; dry-run uses local structured parser only. */
export const strideJdParserProvider: JdParserProvider = {
  id: 'stride',
  label: 'Stride JD parser',
  usesExternalAi: true,

  async parse(source, ctx) {
    if (!ctx.aiConsented) {
      return {
        ok: false,
        error: 'Stride JD parser requires explicit org consent in Company Setup before any document is processed.',
      };
    }

    if (process.env.STRIDE_JD_PARSER_ENABLE_AI === '1') {
      return {
        ok: false,
        error:
          'Stride LLM JD extractor is not wired in this cell yet. Use manual entry or enable STRIDE_JD_PARSER_DRY_RUN=1 for local structured parsing during development.',
      };
    }

    if (process.env.STRIDE_JD_PARSER_DRY_RUN === '1') {
      return parseStructuredJdText(source);
    }

    return {
      ok: false,
      error:
        'Stride AI JD parsing is disabled. Set org parser mode to manual, or enable STRIDE_JD_PARSER_DRY_RUN for non-AI structured extraction in development.',
    };
  },
};
