import { registerKpiSourceProvider } from '@/lib/performance/kpi/kpi-source-provider';
import { BUILTIN_KPI_PROVIDERS } from '@/lib/performance/kpi/builtin-providers';

let registered = false;

export function registerBuiltinKpiProviders() {
  if (registered) return;
  for (const provider of BUILTIN_KPI_PROVIDERS) {
    registerKpiSourceProvider(provider);
  }
  registered = true;
}

export function resetBuiltinKpiProvidersForTests() {
  registered = false;
}
