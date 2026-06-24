import type {
  PayrollDisbursementBatchStatus,
  PayrollDisbursementLineStatus,
} from '@prisma/client';

export type DisbursementRecipient = {
  lineId: string;
  phone: string;
  amount: number;
  reference: string;
  employeeName: string;
};

export type DisbursementLineResult = {
  lineId: string;
  providerRef?: string;
  status: Extract<PayrollDisbursementLineStatus, 'submitted' | 'failed' | 'skipped'>;
  failureReason?: string;
};

export type DisbursementSubmitResult = {
  providerRef: string;
  lineResults: DisbursementLineResult[];
};

export type DisbursementPollLineResult = {
  lineId: string;
  status: PayrollDisbursementLineStatus;
  providerRef?: string;
  failureReason?: string;
};

export type DisbursementPollResult = {
  batchStatus: PayrollDisbursementBatchStatus;
  lines: DisbursementPollLineResult[];
  failureSummary?: string;
};

export interface PayrollDisbursementProvider {
  readonly channel: 'mpesa';
  readonly mode: 'simulated' | 'daraja';
  submitBatch(input: {
    batchId: string;
    recipients: DisbursementRecipient[];
  }): Promise<DisbursementSubmitResult>;
  pollBatch(input: {
    batchId: string;
    providerRef: string;
    pollCount: number;
    lineIds: string[];
  }): Promise<DisbursementPollResult>;
}
