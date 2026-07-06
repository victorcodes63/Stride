/**
 * PERF-06: Auto-measured KPI contract — Sales and other modules register providers here.
 * Performance module owns this interface; consumers register via registerKpiSourceProvider().
 */

export type KpiMeasurementContext = {
  organizationId: string;
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  outsourcingClientId?: string | null;
};

export type KpiMeasurement = {
  value: number | string;
  unit?: string | null;
  evidenceUrl?: string | null;
  asOf?: string | null;
};

export type KpiSourceProvider = {
  /** Stable key referenced by ScorecardMeasure.kpiSourceKey, e.g. sales.pipeline_attainment */
  readonly key: string;
  readonly label: string;
  readonly module: string;
  measure(ctx: KpiMeasurementContext): Promise<KpiMeasurement | null>;
};

const registry = new Map<string, KpiSourceProvider>();

export function registerKpiSourceProvider(provider: KpiSourceProvider) {
  if (registry.has(provider.key)) {
    throw new Error(`KPI source provider already registered: ${provider.key}`);
  }
  registry.set(provider.key, provider);
}

export function getKpiSourceProvider(key: string): KpiSourceProvider | undefined {
  return registry.get(key);
}

export function listKpiSourceProviders(): KpiSourceProvider[] {
  return [...registry.values()];
}

export async function measureAutoKpi(
  key: string,
  ctx: KpiMeasurementContext,
): Promise<KpiMeasurement | null> {
  const provider = getKpiSourceProvider(key);
  if (!provider) return null;
  return provider.measure(ctx);
}
