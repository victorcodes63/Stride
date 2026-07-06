'use client';

import { useMemo } from 'react';
import {
  buildModuleUiGroups,
  getModuleDefinition,
  getModuleLabel,
  type ModuleKey,
} from '@/lib/modules';
import {
  cascadeDisableDependents,
  getDisabledRequiredParents,
} from '@/lib/module-dependencies';
import { HR_DOMAIN_PRESETS, applyHrDomainPreset, type HrDomainPresetId } from '@/lib/module-presets';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { CompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { LayoutGrid, Lock } from 'lucide-react';

export type ModuleCatalogEntry = {
  key: ModuleKey;
  label: string;
  description: string;
  canDisable: boolean;
  licensed: boolean;
  entitled: boolean;
  adminEnabled: boolean;
  enabled: boolean;
};

type Props = {
  form: CompanySetupSettings;
  setForm: React.Dispatch<React.SetStateAction<CompanySetupSettings>>;
  moduleCatalog: ModuleCatalogEntry[];
  capabilities?: CompanySetupCapabilities;
};

export function CompanySetupModulesSection({ form, setForm, moduleCatalog, capabilities }: Props) {
  if (capabilities && !capabilities.canConfigureModuleNav) {
    return null;
  }
  const licensedByKey = Object.fromEntries(moduleCatalog.map((m) => [m.key, m.licensed])) as Record<
    ModuleKey,
    boolean
  >;
  const entitledByKey = Object.fromEntries(moduleCatalog.map((m) => [m.key, m.entitled])) as Record<
    ModuleKey,
    boolean
  >;
  const canToggle = (key: ModuleKey) =>
    (licensedByKey[key] ?? true) && (entitledByKey[key] ?? true);

  const uiGroups = useMemo(
    () => buildModuleUiGroups(form.moduleAdminFlags),
    [form.moduleAdminFlags],
  );

  const visibleCount = moduleCatalog.filter(
    (m) => m.licensed && m.entitled && form.moduleAdminFlags[m.key],
  ).length;
  const licensedCount = moduleCatalog.filter((m) => m.licensed && m.entitled).length;

  const setModuleFlag = (key: ModuleKey, enabled: boolean) => {
    if (key === 'core' || !canToggle(key)) return;

    if (enabled) {
      const missing = getDisabledRequiredParents(key, form.moduleAdminFlags);
      if (missing.length > 0) {
        return;
      }
      setForm((f) => ({
        ...f,
        moduleAdminFlags: { ...f.moduleAdminFlags, [key]: true },
      }));
      return;
    }

    setForm((f) => ({
      ...f,
      moduleAdminFlags: cascadeDisableDependents(key, f.moduleAdminFlags),
    }));
  };

  const applyPreset = (presetId: HrDomainPresetId) => {
    setForm((f) => ({
      ...f,
      moduleAdminFlags: applyHrDomainPreset(presetId, f.moduleAdminFlags),
    }));
  };

  const enableAllLicensed = () => {
    setForm((f) => ({
      ...f,
      moduleAdminFlags: Object.fromEntries(
        Object.keys(f.moduleAdminFlags).map((k) => {
          const key = k as ModuleKey;
          return [key, canToggle(key) ? true : f.moduleAdminFlags[key]];
        }),
      ) as Record<ModuleKey, boolean>,
    }));
  };

  return (
    <section className="space-y-5 dashboard-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold dash-setup-heading">
            <LayoutGrid className="h-5 w-5 dash-setup-heading-icon" aria-hidden />
            Modules &amp; navigation
          </h2>
          <p className="mt-1 max-w-2xl text-sm dash-setup-muted">
            Hide product areas your team does not use. Sidebar, quick actions, and direct links update
            after you save. You can only enable modules included in your subscription.
          </p>
          <p className="mt-2 text-xs dash-setup-subtle">
            {visibleCount} of {licensedCount} entitled modules visible
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {HR_DOMAIN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => applyPreset(preset.id)}
              className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-xs font-medium dash-setup-body transition-colors hover:bg-[var(--dash-hover)]"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={enableAllLicensed}
            className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-xs font-medium dash-setup-body transition-colors hover:bg-[var(--dash-hover)]"
          >
            Show all entitled
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {uiGroups.map((group) => (
          <div key={group.id}>
            <h3 className="text-sm font-semibold dash-setup-label">{group.label}</h3>
            <p className="mt-0.5 text-xs dash-setup-muted">{group.description}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.keys.map((key) => {
                const def = getModuleDefinition(key);
                const isLicensed = licensedByKey[key] ?? true;
                const isEntitled = entitledByKey[key] ?? true;
                const isOn = form.moduleAdminFlags[key];
                const locked = !def.canDisable;
                const disabled = locked || !isLicensed || !isEntitled;
                const missingParents = getDisabledRequiredParents(key, form.moduleAdminFlags);
                const needsParent = !isOn && missingParents.length > 0;

                return (
                  <li key={key}>
                    <label
                      className={`dash-setup-module-row ${disabled || needsParent ? 'dash-setup-module-row--disabled' : 'cursor-pointer'}`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium dash-setup-label">
                          {def.label}
                          {locked ? (
                            <Lock className="h-3.5 w-3.5 dash-setup-subtle" aria-hidden />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs dash-setup-muted">{def.description}</span>
                        {!isLicensed ? (
                          <span className="dash-setup-badge dash-setup-badge--neutral">
                            Not licensed
                          </span>
                        ) : null}
                        {!isEntitled && isLicensed ? (
                          <span className="dash-setup-badge dash-setup-badge--warn">
                            Upgrade required
                          </span>
                        ) : null}
                        {needsParent && isLicensed && isEntitled ? (
                          <span className="dash-setup-badge dash-setup-badge--warn">
                            Requires {missingParents.map((p) => getModuleLabel(p)).join(', ')}
                          </span>
                        ) : null}
                        {isOn && missingParents.length > 0 ? (
                          <span className="dash-setup-badge dash-setup-badge--warn">
                            Parent off — will hide on save
                          </span>
                        ) : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={isLicensed && isEntitled && isOn}
                        disabled={disabled || needsParent}
                        onChange={(e) => setModuleFlag(key, e.target.checked)}
                        className="dash-setup-control mt-1 h-4 w-4 rounded disabled:opacity-50"
                        aria-label={`Show ${def.label} module`}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
