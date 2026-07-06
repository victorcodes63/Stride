import type { BscPerspective } from '@prisma/client';

import type { JobDescriptionInput } from '@/lib/performance/jd/types';
import type { JdParseResult, JdParseSource } from '@/lib/performance/parsing/jd-parser-provider';

const SECTION_PATTERNS: Array<{ key: keyof JobDescriptionInput; patterns: RegExp[] }> = [
  { key: 'jobPurpose', patterns: [/job purpose/i, /purpose of the job/i] },
  { key: 'keyActivities', patterns: [/key activities/i, /principal accountabilities/i, /duties/i] },
  { key: 'authorityScope', patterns: [/authority/i, /decision making/i] },
  { key: 'workingConditions', patterns: [/working conditions/i, /work environment/i] },
  { key: 'qualifications', patterns: [/qualifications/i, /education/i] },
  { key: 'relationships', patterns: [/relationships/i, /reporting/i] },
];

function extractSections(text: string): Partial<Record<keyof JobDescriptionInput, string>> {
  const lines = text.split(/\r?\n/);
  const sections: Partial<Record<keyof JobDescriptionInput, string>> = {};
  let currentKey: keyof JobDescriptionInput | null = null;
  const buffers = new Map<keyof JobDescriptionInput, string[]>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matched = SECTION_PATTERNS.find(({ patterns }) =>
      patterns.some((p) => p.test(trimmed) && trimmed.length < 120),
    );
    if (matched) {
      currentKey = matched.key;
      if (!buffers.has(currentKey)) buffers.set(currentKey, []);
      continue;
    }

    if (currentKey) {
      buffers.get(currentKey)?.push(trimmed);
    }
  }

  for (const [key, buf] of buffers.entries()) {
    sections[key] = buf.join('\n');
  }

  return sections;
}

function inferTitle(text: string, fileName: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim();
  if (firstLine && firstLine.length < 120) return firstLine.replace(/^job description\s*[-:]\s*/i, '');
  return fileName.replace(/\.(docx|pdf|txt)$/i, '').replace(/[_-]+/g, ' ');
}

/** Deterministic local extractor — no network, no AI. Used by Stride dry-run and BYO fallback tests. */
export function parseStructuredJdText(source: JdParseSource): JdParseResult {
  const sections = extractSections(source.text);
  const title = inferTitle(source.text, source.fileName);

  const draft: JobDescriptionInput = {
    title,
    grade: null,
    jobPurpose: (sections.jobPurpose as string) ?? null,
    keyActivities: (sections.keyActivities as string) ?? null,
    authorityScope: (sections.authorityScope as string) ?? null,
    workingConditions: (sections.workingConditions as string) ?? null,
    qualifications: (sections.qualifications as string) ?? null,
    relationships: (sections.relationships as string) ?? null,
    kras: [
      {
        title: 'Operational results',
        bscPerspective: 'internal_process' as BscPerspective,
        weightPercent: 50,
        kpis: [{ name: 'Deliverables on time', targetValue: '≥90', unit: '%', weightPercent: 100 }],
      },
      {
        title: 'Stakeholder service',
        bscPerspective: 'customer' as BscPerspective,
        weightPercent: 50,
        kpis: [{ name: 'Stakeholder satisfaction', targetValue: '≥4', unit: '/5', weightPercent: 100 }],
      },
    ],
    competencies: [{ name: 'Role competency (review required)', requiredLevel: 3 }],
  };

  return {
    ok: true,
    draft,
    warnings: ['Structured text parser — manager must confirm all fields before publish.'],
  };
}
