export type StatementEntry = {
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type AgeingBuckets = {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  over90: number;
  total: number;
};

export type ClientStatement = {
  clientId: string;
  clientName: string;
  clientType: string;
  currency: string;
  contactEmail: string | null;
  entries: StatementEntry[];
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    closingBalance: number;
  };
  ageing: AgeingBuckets;
};

export type VendorStatement = {
  vendorId: string;
  vendorName: string;
  currency: string;
  contactEmail: string | null;
  entries: StatementEntry[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    closingBalance: number;
  };
  ageing: AgeingBuckets;
};

type InvoiceLike = {
  issueDate: Date;
  dueDate?: Date | null;
  invoiceNumber?: number;
  lines: { amountExVat: unknown }[];
  vatRateBps: number;
  totalOverrideIncVat?: unknown | null;
  allocations: { amount: unknown }[];
  creditNotes: { totalIncVat: unknown }[];
};

type BillLike = {
  issueDate: Date;
  dueDate?: Date | null;
  billRef?: string | null;
  lines: { amountExVat: unknown }[];
  vatRateBps: number;
  allocations: { amount: unknown }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function invoiceTotal(inv: InvoiceLike): number {
  const subtotal = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
  const vatAmount = Math.round(subtotal * (inv.vatRateBps / 10000) * 100) / 100;
  return inv.totalOverrideIncVat ? Number(inv.totalOverrideIncVat) : subtotal + vatAmount;
}

function billTotal(bill: BillLike): number {
  const subtotal = bill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
  const vatAmount = Math.round(subtotal * (bill.vatRateBps / 10000) * 100) / 100;
  return subtotal + vatAmount;
}

function outstandingInvoice(inv: InvoiceLike): number {
  const total = invoiceTotal(inv);
  const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const credited = inv.creditNotes.reduce((s, cn) => s + Number(cn.totalIncVat), 0);
  return Math.max(0, round2(total - paid - credited));
}

function outstandingBill(bill: BillLike): number {
  const total = billTotal(bill);
  const paid = bill.allocations.reduce((s, a) => s + Number(a.amount), 0);
  return Math.max(0, round2(total - paid));
}

/** Bucket open balances by days past due (uses due date, else issue date). */
export function computeAgeingBuckets(
  items: Array<{ dueDate: Date | null | undefined; issueDate: Date; outstanding: number }>,
  asOf: Date = new Date(),
): AgeingBuckets {
  const buckets: AgeingBuckets = {
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    over90: 0,
    total: 0,
  };

  const asOfMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());

  for (const item of items) {
    const outstanding = round2(item.outstanding);
    if (outstanding <= 0) continue;

    const anchor = item.dueDate ?? item.issueDate;
    const anchorMs = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
    const daysPastDue = Math.floor((asOfMs - anchorMs) / 86_400_000);

    if (daysPastDue <= 0) buckets.current += outstanding;
    else if (daysPastDue <= 30) buckets.days1_30 += outstanding;
    else if (daysPastDue <= 60) buckets.days31_60 += outstanding;
    else if (daysPastDue <= 90) buckets.days61_90 += outstanding;
    else buckets.over90 += outstanding;

    buckets.total += outstanding;
  }

  return {
    current: round2(buckets.current),
    days1_30: round2(buckets.days1_30),
    days31_60: round2(buckets.days31_60),
    days61_90: round2(buckets.days61_90),
    over90: round2(buckets.over90),
    total: round2(buckets.total),
  };
}

export function sumAgeingBuckets(statements: Array<{ ageing: AgeingBuckets }>): AgeingBuckets {
  const sum: AgeingBuckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0, total: 0 };
  for (const s of statements) {
    sum.current += s.ageing.current;
    sum.days1_30 += s.ageing.days1_30;
    sum.days31_60 += s.ageing.days31_60;
    sum.days61_90 += s.ageing.days61_90;
    sum.over90 += s.ageing.over90;
    sum.total += s.ageing.total;
  }
  return {
    current: round2(sum.current),
    days1_30: round2(sum.days1_30),
    days31_60: round2(sum.days31_60),
    days61_90: round2(sum.days61_90),
    over90: round2(sum.over90),
    total: round2(sum.total),
  };
}

export function buildClientStatement(c: {
  id: string;
  name: string;
  type: string;
  currency: string;
  contactEmail?: string | null;
  invoices: InvoiceLike[];
  clientPayments: Array<{
    receivedAt: Date;
    amount: unknown;
    reference: string | null;
    method: string | null;
  }>;
}): ClientStatement {
  let runningBalance = 0;
  const allItems: Array<{
    date: Date;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  for (const inv of c.invoices) {
    const total = invoiceTotal(inv);
    allItems.push({
      date: inv.issueDate,
      type: 'invoice',
      reference: `INV-${String(inv.invoiceNumber).padStart(4, '0')}`,
      description: `Invoice #${inv.invoiceNumber}`,
      debit: total,
      credit: 0,
    });
    for (const cn of inv.creditNotes) {
      allItems.push({
        date: inv.issueDate,
        type: 'credit_note',
        reference: `CN on INV-${String(inv.invoiceNumber).padStart(4, '0')}`,
        description: 'Credit note',
        debit: 0,
        credit: Number(cn.totalIncVat),
      });
    }
  }

  for (const pmt of c.clientPayments) {
    allItems.push({
      date: pmt.receivedAt,
      type: 'payment',
      reference: pmt.reference || pmt.method || 'Payment',
      description: `Payment received${pmt.method ? ` (${pmt.method})` : ''}`,
      debit: 0,
      credit: Number(pmt.amount),
    });
  }

  allItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const entries: StatementEntry[] = allItems.map((item) => {
    runningBalance += item.debit - item.credit;
    return {
      date: new Date(item.date).toISOString().split('T')[0]!,
      type: item.type,
      reference: item.reference,
      description: item.description,
      debit: item.debit,
      credit: item.credit,
      balance: round2(runningBalance),
    };
  });

  const totalDebits = allItems.reduce((s, i) => s + i.debit, 0);
  const totalCredits = allItems.reduce((s, i) => s + i.credit, 0);

  const ageing = computeAgeingBuckets(
    c.invoices.map((inv) => ({
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
      outstanding: outstandingInvoice(inv),
    })),
  );

  return {
    clientId: c.id,
    clientName: c.name,
    clientType: c.type,
    currency: c.currency,
    contactEmail: c.contactEmail ?? null,
    entries,
    summary: {
      totalInvoiced: round2(totalDebits),
      totalPaid: round2(totalCredits),
      closingBalance: round2(runningBalance),
    },
    ageing,
  };
}

export function buildVendorStatement(v: {
  id: string;
  name: string;
  currency: string;
  contactEmail?: string | null;
  bills: BillLike[];
  payments: Array<{
    paidAt: Date;
    amount: unknown;
    reference: string | null;
    method: string | null;
  }>;
}): VendorStatement {
  let runningBalance = 0;
  const allItems: Array<{
    date: Date;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  for (const bill of v.bills) {
    const total = billTotal(bill);
    allItems.push({
      date: bill.issueDate,
      type: 'bill',
      reference: bill.billRef || 'Bill',
      description: `Vendor bill${bill.billRef ? ` ${bill.billRef}` : ''}`,
      debit: total,
      credit: 0,
    });
  }

  for (const pmt of v.payments) {
    allItems.push({
      date: pmt.paidAt,
      type: 'payment',
      reference: pmt.reference || 'Payment',
      description: `Payment made${pmt.method ? ` (${pmt.method})` : ''}`,
      debit: 0,
      credit: Number(pmt.amount),
    });
  }

  allItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const entries: StatementEntry[] = allItems.map((item) => {
    runningBalance += item.debit - item.credit;
    return {
      date: new Date(item.date).toISOString().split('T')[0]!,
      type: item.type,
      reference: item.reference,
      description: item.description,
      debit: item.debit,
      credit: item.credit,
      balance: round2(runningBalance),
    };
  });

  const totalDebits = allItems.reduce((s, i) => s + i.debit, 0);
  const totalCredits = allItems.reduce((s, i) => s + i.credit, 0);

  const ageing = computeAgeingBuckets(
    v.bills.map((bill) => ({
      dueDate: bill.dueDate,
      issueDate: bill.issueDate,
      outstanding: outstandingBill(bill),
    })),
  );

  return {
    vendorId: v.id,
    vendorName: v.name,
    currency: v.currency,
    contactEmail: v.contactEmail ?? null,
    entries,
    summary: {
      totalBilled: round2(totalDebits),
      totalPaid: round2(totalCredits),
      closingBalance: round2(runningBalance),
    },
    ageing,
  };
}
