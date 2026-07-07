export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerBuiltinKpiProviders } = await import('@/lib/performance/kpi/register-builtin-providers');
    registerBuiltinKpiProviders();
    try {
      const { registerSalesKpiProviders } = await import('@/lib/sales/register-kpi-providers');
      registerSalesKpiProviders();
    } catch {
      // Sales module optional — PERF-06 contract is owned by performance; SALES-04 registers when present.
    }
  }
}
