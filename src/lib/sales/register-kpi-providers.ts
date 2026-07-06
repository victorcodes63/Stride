import { registerKpiSourceProvider } from '@/lib/performance/kpi/kpi-source-provider';
import { salesPipelineAttainmentProvider } from '@/lib/sales/kpi/pipeline-attainment-provider';

let registered = false;

/** Idempotent — safe to call from instrumentation and tests. */
export function registerSalesKpiProviders() {
  if (registered) return;
  registerKpiSourceProvider(salesPipelineAttainmentProvider);
  registered = true;
}

export function resetSalesKpiProvidersForTests() {
  registered = false;
}
