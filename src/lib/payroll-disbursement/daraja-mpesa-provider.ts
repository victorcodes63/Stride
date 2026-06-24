import type { PayrollDisbursementProvider } from '@/lib/payroll-disbursement/types';

/**
 * Safaricom Daraja B2C — wired when MPESA_PROVIDER=daraja and credentials are set.
 * Throws until OAuth + B2C payment request flow is implemented (use simulated mode for demos).
 */
export class DarajaMpesaProvider implements PayrollDisbursementProvider {
  readonly channel = 'mpesa' as const;
  readonly mode = 'daraja' as const;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[payroll-disbursement] DarajaMpesaProvider is a stub — falling back to simulated in getPayrollDisbursementProvider until B2C is wired.',
      );
    }
  }

  async submitBatch(): Promise<never> {
    throw new Error('Daraja M-Pesa B2C is not wired yet. Use MPESA_PROVIDER=simulated for sandbox demos.');
  }

  async pollBatch(): Promise<never> {
    throw new Error('Daraja M-Pesa B2C is not wired yet. Use MPESA_PROVIDER=simulated for sandbox demos.');
  }
}
