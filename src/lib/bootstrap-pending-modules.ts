import type { ModuleKey } from '@/lib/modules';

/** Sidebar defaults before bootstrap — fail closed (no recruitment flash). */
export const BOOTSTRAP_PENDING_MODULES: Record<ModuleKey, boolean> = {
  core: true,
  accounts: true,
  ess: true,
  leave: false,
  time: false,
  payroll: false,
  ats: false,
  performance: false,
  hse: false,
  disciplinary: false,
  reports: false,
  assets: false,
  fleet: false,
  sacco: false,
  healthcare: false,
  energy: false,
  construction: false,
  communications: false,
  training: false,
  documents: false,
  procurement: false,
  legal: false,
};
