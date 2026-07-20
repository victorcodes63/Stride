import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Canonical procurement document types used for atomic sequence numbering. */
export const PROCUREMENT_DOC_TYPES = {
  PR: 'PR',
  LPO: 'LPO',
  GRN: 'GRN',
  RFQ: 'RFQ',
} as const;

export type ProcurementDocType =
  (typeof PROCUREMENT_DOC_TYPES)[keyof typeof PROCUREMENT_DOC_TYPES];

/** Default human-facing prefix for each document type. */
export const PROCUREMENT_DOC_PREFIX: Record<ProcurementDocType, string> = {
  PR: 'PR',
  LPO: 'LPO',
  GRN: 'GRN',
  RFQ: 'RFQ',
};

export type NextProcurementNumberParams = {
  organizationId: string;
  outsourcingClientId: string;
  docType: ProcurementDocType | string;
  /** Formatted-number prefix — defaults to the docType prefix (e.g. `PR`). */
  prefix?: string;
  /** Sequence year — defaults to the current UTC year. */
  year?: number;
  /** Zero-padding width for the numeric suffix (default 4). */
  pad?: number;
};

/**
 * Atomically reserve the next sequential document number for a tenant + docType + year and
 * return it formatted (e.g. `PR-2026-0001`).
 *
 * Concurrency-safe: relies on the `@@unique([organizationId, outsourcingClientId, docType, year])`
 * constraint and an atomic `increment` update. Must be called inside the caller's transaction so
 * the reserved number and the row that consumes it commit together.
 */
export async function nextProcurementNumber(
  tx: Db,
  params: NextProcurementNumberParams,
): Promise<string> {
  const year = params.year ?? new Date().getUTCFullYear();
  const pad = params.pad ?? 4;
  const prefix =
    params.prefix ??
    PROCUREMENT_DOC_PREFIX[params.docType as ProcurementDocType] ??
    params.docType;

  // `nextValue` stores the *next* number to hand out. Creating the row seeds it to 2 and
  // consumes 1; subsequent calls increment atomically. In both branches the reserved value
  // is `nextValue - 1`.
  const seq = await tx.procurementSequence.upsert({
    where: {
      organizationId_outsourcingClientId_docType_year: {
        organizationId: params.organizationId,
        outsourcingClientId: params.outsourcingClientId,
        docType: params.docType,
        year,
      },
    },
    create: {
      organizationId: params.organizationId,
      outsourcingClientId: params.outsourcingClientId,
      docType: params.docType,
      year,
      nextValue: 2,
    },
    update: {
      nextValue: { increment: 1 },
    },
    select: { nextValue: true },
  });

  const value = seq.nextValue - 1;
  return `${prefix}-${year}-${String(value).padStart(pad, '0')}`;
}
