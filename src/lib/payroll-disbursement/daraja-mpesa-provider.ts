import {
  darajaCredentialsConfigured,
  submitB2CPayment,
} from '@/lib/payroll-disbursement/daraja-client';
import type {
  DisbursementPollResult,
  DisbursementRecipient,
  DisbursementSubmitResult,
  PayrollDisbursementProvider,
} from '@/lib/payroll-disbursement/types';

/**
 * Safaricom Daraja B2C — one payment request per payroll line.
 * Completion is driven by B2C result webhooks; pollBatch aggregates in-flight line states.
 */
export class DarajaMpesaProvider implements PayrollDisbursementProvider {
  readonly channel = 'mpesa' as const;
  readonly mode = 'daraja' as const;

  constructor() {
    if (!darajaCredentialsConfigured()) {
      throw new Error(
        'Daraja M-Pesa credentials are incomplete. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_INITIATOR_NAME, and MPESA_SECURITY_CREDENTIAL.',
      );
    }
  }

  async submitBatch(input: {
    batchId: string;
    recipients: DisbursementRecipient[];
  }): Promise<DisbursementSubmitResult> {
    const providerRef = `DARAJA-BATCH-${input.batchId}`;
    const lineResults: DisbursementSubmitResult['lineResults'] = [];

    for (const recipient of input.recipients) {
      if (!recipient.phone || recipient.amount <= 0) {
        lineResults.push({
          lineId: recipient.lineId,
          status: 'failed',
          failureReason: !recipient.phone ? 'Missing M-Pesa phone number' : 'Invalid amount',
        });
        continue;
      }

      try {
        const payment = await submitB2CPayment({
          phone: recipient.phone,
          amount: recipient.amount,
          remarks: recipient.reference,
          occasion: recipient.employeeName.slice(0, 100),
        });
        lineResults.push({
          lineId: recipient.lineId,
          status: 'submitted',
          providerRef: payment.originatorConversationId || payment.conversationId,
        });
      } catch (error) {
        lineResults.push({
          lineId: recipient.lineId,
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'B2C submission failed',
        });
      }
    }

    return { providerRef, lineResults };
  }

  async pollBatch(input: {
    batchId: string;
    providerRef: string;
    pollCount: number;
    lineIds: string[];
  }): Promise<DisbursementPollResult> {
    // Daraja completion is webhook-driven; service layer re-reads line rows before calling this.
    // Return processing until the service aggregates terminal line states from the database.
    void input;
    return {
      batchStatus: 'processing',
      lines: input.lineIds.map((lineId) => ({
        lineId,
        status: 'processing',
      })),
    };
  }
}

/** Aggregate disbursement line DB statuses into a poll result (Daraja webhook path). */
export function aggregateDarajaLinePoll(
  lines: Array<{ id: string; status: string; providerRef: string | null; failureReason: string | null }>,
): DisbursementPollResult {
  const pollLines = lines.map((line) => ({
    lineId: line.id,
    status: line.status as DisbursementPollResult['lines'][number]['status'],
    providerRef: line.providerRef ?? undefined,
    failureReason: line.failureReason ?? undefined,
  }));

  const terminal = new Set(['completed', 'failed', 'skipped']);
  const allTerminal = lines.length > 0 && lines.every((l) => terminal.has(l.status));
  const anyCompleted = lines.some((l) => l.status === 'completed');
  const anyFailed = lines.some((l) => l.status === 'failed' || l.status === 'skipped');
  const anyPending = lines.some((l) => !terminal.has(l.status));

  let batchStatus: DisbursementPollResult['batchStatus'] = 'processing';
  if (allTerminal) {
    if (anyCompleted && anyFailed) batchStatus = 'partial_failure';
    else if (anyCompleted) batchStatus = 'completed';
    else batchStatus = 'failed';
  } else if (!anyPending && anyFailed) {
    batchStatus = 'partial_failure';
  }

  const failedCount = lines.filter((l) => l.status === 'failed' || l.status === 'skipped').length;
  const failureSummary =
    failedCount > 0 ? `${failedCount} employee(s) failed M-Pesa disbursement` : undefined;

  return { batchStatus, lines: pollLines, failureSummary };
}
