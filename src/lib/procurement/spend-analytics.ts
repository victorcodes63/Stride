import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type SpendBucket = {
  key: string;
  label: string;
  committed: number;
  ordered: number;
  invoiced: number;
  budgetAllocated: number;
};

export type SpendReport = {
  year: number;
  currency: string;
  totals: {
    committed: number;
    ordered: number;
    received: number;
    invoiced: number;
  };
  byDepartment: SpendBucket[];
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    committed: number;
    ordered: number;
    invoiced: number;
  }>;
  byBudgetLine: Array<{
    budgetLineId: string;
    budgetName: string;
    lineName: string;
    department: string | null;
    allocated: number;
    budgetSpent: number;
    procurementSpend: number;
  }>;
  monthlyOrdered: number[];
};

function yearRange(year: number) {
  return {
    start: new Date(`${year}-01-01T00:00:00.000Z`),
    end: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
}

function inYear(date: Date | null | undefined, year: number): boolean {
  if (!date) return false;
  return date.getUTCFullYear() === year;
}

function deptKey(department: string | null | undefined): string {
  const d = department?.trim();
  return d || 'Unassigned';
}

export function sumMonthlyOrdered(
  orders: Array<{ issuedAt: Date | null; totalAmount: number; status: string }>,
  year: number,
): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const o of orders) {
    if (o.status !== 'issued' && o.status !== 'fulfilled') continue;
    const at = o.issuedAt;
    if (!inYear(at, year)) continue;
    const m = (at as Date).getUTCMonth();
    months[m] += Number(o.totalAmount);
  }
  return months.map((v) => Math.round(v * 100) / 100);
}

export async function buildProcurementSpendReport(
  db: Db,
  params: { outsourcingClientId: string; year: number },
): Promise<SpendReport> {
  const { year } = params;
  const { start, end } = yearRange(year);

  const [requests, orders, receipts, budgets] = await Promise.all([
    db.purchaseRequest.findMany({
      where: {
        outsourcingClientId: params.outsourcingClientId,
        createdAt: { gte: start, lt: end },
        status: { in: ['submitted', 'approved'] },
      },
      select: {
        department: true,
        totalAmount: true,
        status: true,
        currency: true,
        vendorId: true,
        vendor: { select: { name: true } },
      },
    }),
    db.purchaseOrder.findMany({
      where: {
        outsourcingClientId: params.outsourcingClientId,
        createdAt: { gte: start, lt: end },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseRequest: { select: { department: true } },
        vendorBill: { select: { id: true, lines: { select: { amountExVat: true } } } },
      },
    }),
    db.goodsReceipt.findMany({
      where: {
        outsourcingClientId: params.outsourcingClientId,
        receivedAt: { gte: start, lt: end },
        status: 'posted',
      },
      include: {
        lines: {
          include: {
            purchaseOrderLine: { select: { unitPrice: true } },
          },
        },
      },
    }),
    db.budget.findMany({
      where: {
        fiscalYear: year,
        status: { in: ['active'] },
      },
      include: { items: true },
    }),
  ]);

  const currency = orders[0]?.currency ?? requests[0]?.currency ?? 'KES';

  let receivedTotal = 0;
  for (const grn of receipts) {
    for (const line of grn.lines) {
      receivedTotal += Number(line.quantityReceived) * Number(line.purchaseOrderLine.unitPrice);
    }
  }
  receivedTotal = Math.round(receivedTotal * 100) / 100;

  const deptMap = new Map<string, SpendBucket>();
  function ensureDept(department: string | null | undefined) {
    const key = deptKey(department);
    let row = deptMap.get(key);
    if (!row) {
      row = { key, label: key, committed: 0, ordered: 0, invoiced: 0, budgetAllocated: 0 };
      deptMap.set(key, row);
    }
    return row;
  }

  for (const r of requests) {
    const row = ensureDept(r.department);
    row.committed += Number(r.totalAmount);
  }

  const vendorMap = new Map<
    string,
    { vendorId: string; vendorName: string; committed: number; ordered: number; invoiced: number }
  >();

  function ensureVendor(vendorId: string, vendorName: string) {
    let row = vendorMap.get(vendorId);
    if (!row) {
      row = { vendorId, vendorName, committed: 0, ordered: 0, invoiced: 0 };
      vendorMap.set(vendorId, row);
    }
    return row;
  }

  for (const r of requests) {
    if (!r.vendorId || !r.vendor) continue;
    if (r.status === 'approved') {
      ensureVendor(r.vendorId, r.vendor.name).committed += Number(r.totalAmount);
    }
  }

  let orderedTotal = 0;
  let invoicedTotal = 0;

  for (const o of orders) {
    const amount = Number(o.totalAmount);
    if (o.status === 'issued' || o.status === 'fulfilled') {
      orderedTotal += amount;
      const dept = o.purchaseRequest?.department;
      ensureDept(dept).ordered += amount;
      const v = ensureVendor(o.vendor.id, o.vendor.name);
      v.ordered += amount;
    }
    if (o.vendorBill) {
      const billTotal = o.vendorBill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
      invoicedTotal += billTotal;
      ensureVendor(o.vendor.id, o.vendor.name).invoiced += billTotal;
      ensureDept(o.purchaseRequest?.department).invoiced += billTotal;
    }
  }

  orderedTotal = Math.round(orderedTotal * 100) / 100;
  invoicedTotal = Math.round(invoicedTotal * 100) / 100;

  const committedTotal = Math.round(
    requests.reduce((s, r) => s + Number(r.totalAmount), 0) * 100,
  ) / 100;

  for (const b of budgets) {
    const key = deptKey(b.department);
    const row = ensureDept(b.department);
    row.budgetAllocated += Number(b.allocatedAmount);
  }

  const deptSpend = new Map<string, number>();
  for (const r of requests) {
    if (r.status !== 'approved') continue;
    const key = deptKey(r.department);
    deptSpend.set(key, (deptSpend.get(key) ?? 0) + Number(r.totalAmount));
  }
  for (const o of orders) {
    if (o.status !== 'issued' && o.status !== 'fulfilled') continue;
    const key = deptKey(o.purchaseRequest?.department);
    deptSpend.set(key, (deptSpend.get(key) ?? 0) + Number(o.totalAmount));
  }

  const byBudgetLine: SpendReport['byBudgetLine'] = [];
  for (const b of budgets) {
    const dept = deptKey(b.department);
    const procurementSpend = Math.round((deptSpend.get(dept) ?? 0) * 100) / 100;
    if (b.items.length === 0) {
      byBudgetLine.push({
        budgetLineId: b.id,
        budgetName: b.name,
        lineName: b.name,
        department: b.department,
        allocated: Number(b.allocatedAmount),
        budgetSpent: Number(b.spentAmount),
        procurementSpend,
      });
      continue;
    }
    const perLineProcurement = Math.round((procurementSpend / b.items.length) * 100) / 100;
    for (const item of b.items) {
      byBudgetLine.push({
        budgetLineId: item.id,
        budgetName: b.name,
        lineName: item.name,
        department: b.department,
        allocated: Number(item.allocatedAmount),
        budgetSpent: Number(item.spentAmount),
        procurementSpend: perLineProcurement,
      });
    }
  }

  byBudgetLine.sort((a, b) => b.procurementSpend - a.procurementSpend);

  return {
    year,
    currency,
    totals: {
      committed: committedTotal,
      ordered: orderedTotal,
      received: receivedTotal,
      invoiced: invoicedTotal,
    },
    byDepartment: [...deptMap.values()].sort((a, b) => b.ordered - a.ordered),
    byVendor: [...vendorMap.values()].sort((a, b) => b.ordered - a.ordered),
    byBudgetLine,
    monthlyOrdered: sumMonthlyOrdered(
      orders.map((o) => ({
        issuedAt: o.issuedAt,
        totalAmount: Number(o.totalAmount),
        status: o.status,
      })),
      year,
    ),
  };
}
