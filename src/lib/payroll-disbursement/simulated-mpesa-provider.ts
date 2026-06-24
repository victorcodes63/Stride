import type {
  DisbursementPollResult,
  DisbursementRecipient,
  DisbursementSubmitResult,
  PayrollDisbursementProvider,
} from '@/lib/payroll-disbursement/types';

/**
 * Deterministic M-Pesa sandbox — no Daraja credentials required.
 * First poll moves lines to processing; second poll completes (demo fail on invalid refs).
 */
export class SimulatedMpesaProvider implements PayrollDisbursementProvider {
  readonly channel = 'mpesa' as const;
  readonly mode = 'simulated' as const;

  async submitBatch(input: {
    batchId: string;
    recipients: DisbursementRecipient[];
  }): Promise<DisbursementSubmitResult> {
    const providerRef = `SIM-BATCH-${input.batchId}`;
    const lineResults = input.recipients.map((r) => {
      if (!r.phone || r.amount <= 0) {
        return {
          lineId: r.lineId,
          status: 'failed' as const,
          failureReason: !r.phone ? 'Missing M-Pesa phone number' : 'Invalid amount',
        };
      }
      return {
        lineId: r.lineId,
        status: 'submitted' as const,
        providerRef: `SIM-TXN-${r.lineId}`,
      };
    });
    return { providerRef, lineResults };
  }

  async pollBatch(input: {
    batchId: string;
    providerRef: string;
    pollCount: number;
    lineIds: string[];
  }): Promise<DisbursementPollResult> {
    if (input.pollCount < 1) {
      return {
        batchStatus: 'processing',
        lines: input.lineIds.map((lineId) => ({
          lineId,
          status: 'processing',
          providerRef: `SIM-TXN-${lineId}`,
        })),
      };
    }

    const lines = input.lineIds.map((lineId) => ({
      lineId,
      status: 'completed' as const,
      providerRef: `SIM-TXN-${lineId}`,
    }));

    return {
      batchStatus: 'completed',
      lines,
    };
  }
}
