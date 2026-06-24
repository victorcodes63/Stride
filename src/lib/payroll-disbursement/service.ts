import type { Prisma } from '@prisma/client';

import { formatBankExportPaymentReference } from '@/lib/payroll-bank-export';
import { normalizeKenyanMsisdn } from '@/lib/payroll-disbursement/phone';
import { getPayrollDisbursementProvider } from '@/lib/payroll-disbursement/provider';
import type { DisbursementRecipient } from '@/lib/payroll-disbursement/types';

export type CreateDisbursementInput = {
  organizationId: string;
  outsourcingClientId: string;
  month: number;
  year: number;
  initiatedByUserId: string;
};

export type DisbursementBatchDto = {
  id: string;
  month: number;
  year: number;
  channel: string;
  status: string;
  providerRef: string | null;
  providerMode: string;
  submittedAt: string | null;
  completedAt: string | null;
  failureSummary: string | null;
  totals: {
    lines: number;
    completed: number;
    failed: number;
    pending: number;
  };
  lines?: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string | null;
    amount: number;
    phone: string | null;
    status: string;
    providerRef: string | null;
    failureReason: string | null;
  }>;
};

function summarizeLines(
  lines: Array<{ status: string }>,
): DisbursementBatchDto['totals'] {
  const totals = { lines: lines.length, completed: 0, failed: 0, pending: 0 };
  for (const line of lines) {
    if (line.status === 'completed') totals.completed += 1;
    else if (line.status === 'failed' || line.status === 'skipped') totals.failed += 1;
    else totals.pending += 1;
  }
  return totals;
}

export function serializeBatch(
  batch: {
    id: string;
    month: number;
    year: number;
    channel: string;
    status: string;
    providerRef: string | null;
    submittedAt: Date | null;
    completedAt: Date | null;
    failureSummary: string | null;
    lines: Array<{
      id: string;
      employeeId: string;
      amount: Prisma.Decimal;
      phone: string | null;
      status: string;
      providerRef: string | null;
      failureReason: string | null;
      employee: {
        firstName: string;
        lastName: string;
        employeeNumber: string | null;
      };
    }>;
  },
  providerMode: string,
  includeLines = false,
): DisbursementBatchDto {
  const dto: DisbursementBatchDto = {
    id: batch.id,
    month: batch.month,
    year: batch.year,
    channel: batch.channel,
    status: batch.status,
    providerRef: batch.providerRef,
    providerMode,
    submittedAt: batch.submittedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    failureSummary: batch.failureSummary,
    totals: summarizeLines(batch.lines),
  };
  if (includeLines) {
    dto.lines = batch.lines.map((line) => ({
      id: line.id,
      employeeId: line.employeeId,
      employeeName: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
      employeeNumber: line.employee.employeeNumber,
      amount: Number(line.amount),
      phone: line.phone,
      status: line.status,
      providerRef: line.providerRef,
      failureReason: line.failureReason,
    }));
  }
  return dto;
}

const lineInclude = {
  employee: {
    select: { firstName: true, lastName: true, employeeNumber: true, phone: true },
  },
} as const;

export async function listDisbursementBatches(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; outsourcingClientId: string; month: number; year: number },
  providerMode: string,
) {
  const batches = await tx.payrollDisbursementBatch.findMany({
    where: {
      organizationId: input.organizationId,
      outsourcingClientId: input.outsourcingClientId,
      month: input.month,
      year: input.year,
    },
    include: { lines: { include: lineInclude } },
    orderBy: { createdAt: 'desc' },
  });
  return batches.map((b) => serializeBatch(b, providerMode, false));
}

export async function getDisbursementBatch(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; batchId: string },
  providerMode: string,
) {
  const batch = await tx.payrollDisbursementBatch.findFirst({
    where: { id: input.batchId, organizationId: input.organizationId },
    include: { lines: { include: lineInclude, orderBy: { employee: { lastName: 'asc' } } } },
  });
  if (!batch) return null;
  return serializeBatch(batch, providerMode, true);
}

export async function createAndSubmitDisbursementBatch(
  tx: Prisma.TransactionClient,
  input: CreateDisbursementInput,
  provider: PayrollDisbursementProvider = getPayrollDisbursementProvider(),
) {
  const payrolls = await tx.payroll.findMany({
    where: {
      organizationId: input.organizationId,
      month: input.month,
      year: input.year,
      employee: { outsourcingClientId: input.outsourcingClientId },
      status: { in: ['approved', 'paid'] },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          employeeNumber: true,
        },
      },
    },
    orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
  });

  if (payrolls.length === 0) {
    return { ok: false as const, error: 'No approved payroll records for this period.' };
  }

  const reference = formatBankExportPaymentReference(input.month, input.year);

  const batch = await tx.payrollDisbursementBatch.create({
    data: {
      organizationId: input.organizationId,
      outsourcingClientId: input.outsourcingClientId,
      month: input.month,
      year: input.year,
      channel: 'mpesa',
      status: 'submitting',
      initiatedByUserId: input.initiatedByUserId,
      lines: {
        create: payrolls.map((p) => ({
          organizationId: input.organizationId,
          payrollId: p.id,
          employeeId: p.employeeId,
          amount: p.netPay,
          phone: normalizeKenyanMsisdn(p.employee.phone),
          status: 'pending',
        })),
      },
    },
    include: { lines: { include: lineInclude } },
  });

  const recipients: DisbursementRecipient[] = batch.lines.map((line) => ({
    lineId: line.id,
    phone: line.phone ?? '',
    amount: Number(line.amount),
    reference,
    employeeName: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
  }));

  const submit = await provider.submitBatch({ batchId: batch.id, recipients });
  const now = new Date();

  for (const result of submit.lineResults) {
    await tx.payrollDisbursementLine.update({
      where: { id: result.lineId },
      data: {
        status: result.status,
        providerRef: result.providerRef ?? null,
        failureReason: result.failureReason ?? null,
        submittedAt: result.status === 'submitted' ? now : null,
      },
    });
  }

  const failed = submit.lineResults.filter((r) => r.status === 'failed').length;
  const submitted = submit.lineResults.filter((r) => r.status === 'submitted').length;
  const batchStatus =
    submitted === 0 ? 'failed' : failed > 0 ? 'partial_failure' : 'processing';

  const updated = await tx.payrollDisbursementBatch.update({
    where: { id: batch.id },
    data: {
      status: batchStatus,
      providerRef: submit.providerRef,
      submittedAt: now,
      failureSummary:
        failed > 0 ? `${failed} employee(s) could not be submitted to M-Pesa` : null,
      completedAt: batchStatus === 'failed' ? now : null,
    },
    include: { lines: { include: lineInclude } },
  });

  return { ok: true as const, batch: serializeBatch(updated, provider.mode, true) };
}

export async function pollDisbursementBatch(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; batchId: string },
  provider: PayrollDisbursementProvider = getPayrollDisbursementProvider(),
) {
  const batch = await tx.payrollDisbursementBatch.findFirst({
    where: { id: input.batchId, organizationId: input.organizationId },
    include: { lines: true },
  });
  if (!batch) return { ok: false as const, error: 'Disbursement batch not found' };
  if (!batch.providerRef) return { ok: false as const, error: 'Batch was not submitted to a provider' };
  if (['completed', 'failed'].includes(batch.status)) {
    const full = await getDisbursementBatch(tx, input, provider.mode);
    return { ok: true as const, batch: full! };
  }

  const poll = await provider.pollBatch({
    batchId: batch.id,
    providerRef: batch.providerRef,
    pollCount: batch.pollCount,
    lineIds: batch.lines.map((l) => l.id),
  });

  const now = new Date();
  for (const line of poll.lines) {
    await tx.payrollDisbursementLine.update({
      where: { id: line.lineId },
      data: {
        status: line.status,
        providerRef: line.providerRef ?? undefined,
        failureReason: line.failureReason ?? null,
        completedAt: line.status === 'completed' ? now : null,
      },
    });
  }

  const updated = await tx.payrollDisbursementBatch.update({
    where: { id: batch.id },
    data: {
      status: poll.batchStatus,
      pollCount: { increment: 1 },
      completedAt: ['completed', 'failed', 'partial_failure'].includes(poll.batchStatus)
        ? now
        : null,
      failureSummary: poll.failureSummary ?? batch.failureSummary,
    },
    include: { lines: { include: lineInclude } },
  });

  if (poll.batchStatus === 'completed') {
    const payrollIds = batch.lines
      .filter((l) => poll.lines.find((pl) => pl.lineId === l.id && pl.status === 'completed'))
      .map((l) => l.payrollId);
    if (payrollIds.length) {
      await tx.payroll.updateMany({
        where: { id: { in: payrollIds }, organizationId: input.organizationId },
        data: { status: 'paid' },
      });
    }
  }

  return { ok: true as const, batch: serializeBatch(updated, provider.mode, true) };
}
