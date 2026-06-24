import { SimulatedMpesaProvider } from '@/lib/payroll-disbursement/simulated-mpesa-provider';
import type { PayrollDisbursementProvider } from '@/lib/payroll-disbursement/types';

let cached: PayrollDisbursementProvider | null = null;

function darajaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY?.trim() &&
      process.env.MPESA_CONSUMER_SECRET?.trim() &&
      process.env.MPESA_SHORTCODE?.trim() &&
      process.env.MPESA_INITIATOR_NAME?.trim() &&
      process.env.MPESA_SECURITY_CREDENTIAL?.trim(),
  );
}

/**
 * Resolves the active payroll disbursement provider.
 * Default: simulated sandbox. Set MPESA_PROVIDER=daraja + Daraja env vars for live sandbox API.
 */
export function getPayrollDisbursementProvider(): PayrollDisbursementProvider {
  if (cached) return cached;

  const mode = (process.env.MPESA_PROVIDER ?? 'simulated').trim().toLowerCase();
  if (mode === 'daraja' && darajaConfigured()) {
    // Lazy-load when Daraja credentials are present (RAV-68 follow-up).
    const { DarajaMpesaProvider } = require('@/lib/payroll-disbursement/daraja-mpesa-provider') as {
      DarajaMpesaProvider: new () => PayrollDisbursementProvider;
    };
    cached = new DarajaMpesaProvider();
    return cached;
  }

  cached = new SimulatedMpesaProvider();
  return cached;
}

export function resetPayrollDisbursementProviderForTests() {
  cached = null;
}
