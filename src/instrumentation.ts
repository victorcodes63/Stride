export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerBuiltinKpiProviders } = await import('@/lib/performance/kpi/register-builtin-providers');
    registerBuiltinKpiProviders();
  }
}
