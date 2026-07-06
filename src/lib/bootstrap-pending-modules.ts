import type { ModuleKey } from '@/lib/module-catalog';
import { MODULE_KEYS } from '@/lib/module-registry';

/** Sidebar defaults before bootstrap — always fail-closed so SSR and client hydration match. */
export const BOOTSTRAP_PENDING_MODULES: Record<ModuleKey, boolean> = Object.fromEntries(
  MODULE_KEYS.map((key) => [key, key === 'core' || key === 'accounts' || key === 'ess']),
) as Record<ModuleKey, boolean>;
