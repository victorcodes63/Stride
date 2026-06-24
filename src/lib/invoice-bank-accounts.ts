/** Mirrors Prisma enum `AccountsInvoicePaymentBank`. */
export type InvoicePaymentBankKind = 'payroll_only' | 'consultancy_fees';

export const INVOICE_PAYMENT_BANK_OPTIONS: {
  value: InvoicePaymentBankKind;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: 'payroll_only',
    label: 'Payroll only (salary remittance & payroll-related payments)',
    shortLabel: 'Payroll only',
  },
  {
    value: 'consultancy_fees',
    label: 'Consultancy & other fees',
    shortLabel: 'Consultancy & other fees',
  },
];

export type HrisBankAccountDetails = {
  purposeTitle: string;
  accountName: string;
  bank: string;
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  swiftCode: string;
};

/** Default invoice bank details (override via env). */
export function getInvoiceBankDetails(kind: InvoicePaymentBankKind): HrisBankAccountDetails {
  const base = {
    accountName:
      process.env.HRIS_BANK_ACCOUNT_NAME?.trim() || 'Stride Limited',
    bank: process.env.HRIS_BANK_NAME?.trim() || 'Equity Bank',
    bankCode: process.env.HRIS_BANK_CODE?.trim() || '068',
    branchCode: process.env.HRIS_BRANCH_CODE?.trim() || '140',
    swiftCode: process.env.HRIS_BANK_SWIFT?.trim() || 'EQBLKENYA',
  };

  if (kind === 'payroll_only') {
    return {
      purposeTitle: 'Payroll only — pay into this account',
      ...base,
      accountNumber:
        process.env.HRIS_BANK_PAYROLL_ACCOUNT?.trim() || '1400274191489',
    };
  }

  return {
    purposeTitle: 'Consultancy & other fees — pay into this account',
    ...base,
    accountNumber:
      process.env.HRIS_BANK_CONSULTANCY_ACCOUNT?.trim() || '1400284455199',
  };
}
