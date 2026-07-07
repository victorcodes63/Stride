/**
 * Client-owned JD manual import — JSON bulk format for multi-role manuals.
 * Stabex reference data stays in stabex-reference.ts (demo/seed only).
 */
import type { BscPerspective } from '@prisma/client';

import type { JobDescriptionInput, JdKpiInput } from '@/lib/performance/jd/types';

export const JD_MANUAL_IMPORT_VERSION = 1;

export type JdManualImportRole = JobDescriptionInput & {
  /** Division name (matched or created per org). */
  division?: string | null;
};

export type JdManualImport = {
  version?: number;
  /** Optional label for audit logs — e.g. "Acme Corp JD Manual 2026". */
  name?: string;
  /** Division names to create before roles (order preserved). */
  divisions?: string[];
  roles: JdManualImportRole[];
};

const BSC_PERSPECTIVES = new Set<BscPerspective>([
  'financial',
  'customer',
  'internal_process',
  'learning_growth',
]);

export const JD_MANUAL_IMPORT_TEMPLATE: JdManualImport = {
  version: JD_MANUAL_IMPORT_VERSION,
  name: 'Your company JD manual',
  divisions: ['Finance', 'Operations', 'Human Resources'],
  roles: [
    {
      division: 'Finance',
      title: 'Finance Manager',
      grade: 'G5',
      jobPurpose: 'Lead financial planning, reporting, and statutory compliance for the entity.',
      keyActivities:
        'Monthly management accounts; budget vs actual; cash flow forecasting; audit liaison.',
      authorityScope: 'Sign-off on journals up to delegated limit per DOA matrix.',
      kras: [
        {
          title: 'Financial reporting accuracy',
          bscPerspective: 'financial',
          weightPercent: 40,
          kpis: [
            { name: 'Close by T+5', targetValue: '100', unit: '%', weightPercent: 50 },
            { name: 'Audit adjustments', targetValue: '≤2', unit: 'items', weightPercent: 50 },
          ],
        },
        {
          title: 'Stakeholder service',
          bscPerspective: 'customer',
          weightPercent: 30,
          kpis: [{ name: 'Business unit satisfaction', targetValue: '≥4', unit: '/5', weightPercent: 100 }],
        },
        {
          title: 'Process discipline',
          bscPerspective: 'internal_process',
          weightPercent: 30,
          kpis: [{ name: 'Policy compliance', targetValue: '100', unit: '%', weightPercent: 100 }],
        },
      ],
      competencies: [
        { name: 'Financial acumen', requiredLevel: 4 },
        { name: 'Communication', requiredLevel: 3 },
        { name: 'Integrity', requiredLevel: 5 },
      ],
    },
    {
      division: 'Operations',
      title: 'Operations Supervisor',
      grade: 'G4',
      jobPurpose: 'Supervise daily operations and team performance against site KPIs.',
      kras: [
        {
          title: 'Operational delivery',
          bscPerspective: 'internal_process',
          weightPercent: 60,
          kpis: [{ name: 'SLA adherence', targetValue: '≥95', unit: '%', weightPercent: 100 }],
        },
        {
          title: 'Team development',
          bscPerspective: 'learning_growth',
          weightPercent: 40,
          kpis: [{ name: 'Training completion', targetValue: '100', unit: '%', weightPercent: 100 }],
        },
      ],
      competencies: [
        { name: 'Leadership', requiredLevel: 3 },
        { name: 'Safety mindset', requiredLevel: 4 },
      ],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseKpi(raw: unknown, path: string): JdKpiInput {
  if (!isRecord(raw)) throw new Error(`${path}: KPI must be an object`);
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) throw new Error(`${path}: KPI name is required`);
  return {
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    targetValue: typeof raw.targetValue === 'string' ? raw.targetValue : undefined,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    weightPercent: typeof raw.weightPercent === 'number' ? raw.weightPercent : undefined,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
  };
}

function parseKra(raw: unknown, path: string) {
  if (!isRecord(raw)) throw new Error(`${path}: KRA must be an object`);
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) throw new Error(`${path}: KRA title is required`);
  const perspective = raw.bscPerspective;
  if (
    perspective != null &&
    typeof perspective === 'string' &&
    !BSC_PERSPECTIVES.has(perspective as BscPerspective)
  ) {
    throw new Error(`${path}: invalid bscPerspective "${perspective}"`);
  }
  const kpisRaw = Array.isArray(raw.kpis) ? raw.kpis : [];
  return {
    title,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    bscPerspective:
      typeof perspective === 'string' ? (perspective as BscPerspective) : undefined,
    weightPercent: typeof raw.weightPercent === 'number' ? raw.weightPercent : undefined,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
    kpis: kpisRaw.map((kpi, i) => parseKpi(kpi, `${path}.kpis[${i}]`)),
  };
}

function parseCompetency(raw: unknown, path: string) {
  if (!isRecord(raw)) throw new Error(`${path}: competency must be an object`);
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) throw new Error(`${path}: competency name is required`);
  const requiredLevel = typeof raw.requiredLevel === 'number' ? raw.requiredLevel : NaN;
  if (!Number.isFinite(requiredLevel) || requiredLevel < 1 || requiredLevel > 5) {
    throw new Error(`${path}: requiredLevel must be 1–5`);
  }
  return {
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    requiredLevel,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
  };
}

function parseRole(raw: unknown, index: number): JdManualImportRole {
  const path = `roles[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path}: role must be an object`);
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) throw new Error(`${path}: title is required`);

  const krasRaw = Array.isArray(raw.kras) ? raw.kras : [];
  const competenciesRaw = Array.isArray(raw.competencies) ? raw.competencies : [];

  return {
    division: typeof raw.division === 'string' ? raw.division.trim() || null : null,
    title,
    grade: typeof raw.grade === 'string' ? raw.grade.trim() || null : null,
    jobPurpose: typeof raw.jobPurpose === 'string' ? raw.jobPurpose : null,
    keyActivities: typeof raw.keyActivities === 'string' ? raw.keyActivities : null,
    authorityScope: typeof raw.authorityScope === 'string' ? raw.authorityScope : null,
    workingConditions: typeof raw.workingConditions === 'string' ? raw.workingConditions : null,
    qualifications: typeof raw.qualifications === 'string' ? raw.qualifications : null,
    relationships: typeof raw.relationships === 'string' ? raw.relationships : null,
    kras: krasRaw.map((kra, i) => parseKra(kra, `${path}.kras[${i}]`)),
    competencies: competenciesRaw.map((c, i) => parseCompetency(c, `${path}.competencies[${i}]`)),
  };
}

export function parseJdManualJson(text: string):
  | { ok: true; manual: JdManualImport }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON — use the JD manual template format.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Root value must be a JSON object.' };
  }

  try {
    const rolesRaw = parsed.roles;
    if (!Array.isArray(rolesRaw) || rolesRaw.length === 0) {
      return { ok: false, error: 'Manual must include a non-empty "roles" array.' };
    }

    const divisionsRaw = parsed.divisions;
    const divisions =
      divisionsRaw == null
        ? undefined
        : Array.isArray(divisionsRaw)
          ? divisionsRaw
              .map((d) => (typeof d === 'string' ? d.trim() : ''))
              .filter((d) => d.length > 0)
          : (() => {
              throw new Error('"divisions" must be an array of strings when provided');
            })();

    const manual: JdManualImport = {
      version:
        typeof parsed.version === 'number' ? parsed.version : JD_MANUAL_IMPORT_VERSION,
      name: typeof parsed.name === 'string' ? parsed.name.trim() || undefined : undefined,
      divisions,
      roles: rolesRaw.map((role, i) => parseRole(role, i)),
    };

    return { ok: true, manual };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to parse JD manual' };
  }
}

export function jdManualImportTemplateJson(pretty = true): string {
  return JSON.stringify(JD_MANUAL_IMPORT_TEMPLATE, null, pretty ? 2 : 0);
}
