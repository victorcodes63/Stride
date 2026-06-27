import { describe, expect, it } from 'vitest';

import { normalizeKenyanMsisdn, formatMsisdnForDisplay } from '@/lib/payroll-disbursement/phone';
import { parseB2CCallbackPayload } from '@/lib/payroll-disbursement/daraja-client';
import { aggregateDarajaLinePoll } from '@/lib/payroll-disbursement/daraja-mpesa-provider';
import { SimulatedMpesaProvider } from '@/lib/payroll-disbursement/simulated-mpesa-provider';

describe('payroll-disbursement phone', () => {
  it('normalizes 07xx to 254', () => {
    expect(normalizeKenyanMsisdn('0712345678')).toBe('254712345678');
  });

  it('accepts 254 format', () => {
    expect(normalizeKenyanMsisdn('254712345678')).toBe('254712345678');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeKenyanMsisdn('123')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatMsisdnForDisplay('254712345678')).toBe('+254 712 345678');
  });
});

describe('SimulatedMpesaProvider', () => {
  const provider = new SimulatedMpesaProvider();

  it('submits valid recipients', async () => {
    const result = await provider.submitBatch({
      batchId: 'batch-1',
      recipients: [
        {
          lineId: 'line-1',
          phone: '254712345678',
          amount: 1000,
          reference: 'SAL-JAN-2026',
          employeeName: 'Jane Doe',
        },
      ],
    });
    expect(result.providerRef).toContain('batch-1');
    expect(result.lineResults[0]?.status).toBe('submitted');
  });

  it('completes on second poll', async () => {
    const lineIds = ['line-1'];
    const first = await provider.pollBatch({
      batchId: 'b1',
      providerRef: 'SIM-BATCH-b1',
      pollCount: 0,
      lineIds,
    });
    expect(first.batchStatus).toBe('processing');

    const second = await provider.pollBatch({
      batchId: 'b1',
      providerRef: 'SIM-BATCH-b1',
      pollCount: 1,
      lineIds,
    });
    expect(second.batchStatus).toBe('completed');
    expect(second.lines[0]?.status).toBe('completed');
  });
});

describe('Daraja helpers', () => {
  it('parses B2C success callback', () => {
    const parsed = parseB2CCallbackPayload({
      Result: {
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        OriginatorConversationID: 'abc-123',
        ConversationID: 'xyz-456',
        ResultParameters: {
          ResultParameter: [{ Key: 'TransactionReceipt', Value: 'QK123' }],
        },
      },
    });
    expect(parsed?.originatorConversationId).toBe('abc-123');
    expect(parsed?.resultCode).toBe(0);
    expect(parsed?.transactionId).toBe('QK123');
  });

  it('aggregates terminal Daraja line states', () => {
    const poll = aggregateDarajaLinePoll([
      { id: 'l1', status: 'completed', providerRef: 'QK1', failureReason: null },
      { id: 'l2', status: 'failed', providerRef: null, failureReason: 'Insufficient funds' },
    ]);
    expect(poll.batchStatus).toBe('partial_failure');
    expect(poll.lines).toHaveLength(2);
  });
});
