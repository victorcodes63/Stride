/** Module keys and catalog — client-safe, no env or DB imports. Derived from module-registry.ts. */
import {
  MODULE_REGISTRY,
  type ModuleKey,
  type ModulePhase,
  type ModuleRegistryEntry,
} from '@/lib/module-registry';

export type { ModuleKey, ModulePhase };

export type ModuleDefinition = Pick<
  ModuleRegistryEntry,
  'key' | 'label' | 'envVar' | 'description' | 'phase' | 'billable' | 'canDisable'
>;

export const MODULE_DEFINITIONS: ModuleDefinition[] = MODULE_REGISTRY.map(
  ({ key, label, envVar, description, phase, billable, canDisable }) => ({
    key,
    label,
    envVar,
    description,
    phase,
    billable,
    canDisable,
  }),
);
