import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    try {
      const reportType = request.nextUrl.searchParams.get('type') || 'summary';
      const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()), 10);
      const orgId = ctx.organizationId;
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year + 1}-01-01`);

      const [invoices, payments, vendorBills, vendorPayments, budgets, expenses] = await ctx.run((tx) =>
        Promise.all([
          tx.accountsInvoice.findMany({
            where: { organizationId: orgId, issueDate: { gte: yearStart, lt: yearEnd } },
            select: {
              id: true,
              issueDate: true,
              status: true,
              currency: true,
              vatRateBps: true,
              totalOverrideIncVat: true,
              lines: { select: { amountExVat: true } },
            },
          }),
          tx.accountsClientPayment.findMany({
            where: { organizationId: orgId, receivedAt: { gte: yearStart, lt: yearEnd } },
            select: { amount: true, receivedAt: true },
          }),
          tx.accountsVendorBill.findMany({
            where: { organizationId: orgId, issueDate: { gte: yearStart, lt: yearEnd } },
            select: {
              id: true,
              issueDate: true,
              status: true,
              vatRateBps: true,
              lines: { select: { amountExVat: true } },
            },
          }),
          tx.accountsVendorPayment.findMany({
            where: { organizationId: orgId, paidAt: { gte: yearStart, lt: yearEnd } },
            select: { amount: true, paidAt: true },
          }),
          tx.budget.findMany({
            where: { organizationId: orgId, fiscalYear: year },
            select: { allocatedAmount: true, spentAmount: true, department: true, status: true },
          }),
          tx.expenseClaim.findMany({
            where: { organizationId: orgId, createdAt: { gte: yearStart, lt: yearEnd } },
            select: { totalAmount: true, status: true },
          }),
        ]),
      );

    const totalRevenue = invoices.reduce((sum, inv) => {
      const subtotal = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
      const vat = Math.round(subtotal * (inv.vatRateBps / 10000) * 100) / 100;
      return sum + (inv.totalOverrideIncVat ? Number(inv.totalOverrideIncVat) : subtotal + vat);
    }, 0);

    const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0);

    const totalExpenses = vendorBills.reduce((sum, bill) => {
      const subtotal = bill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
      const vat = Math.round(subtotal * (bill.vatRateBps / 10000) * 100) / 100;
      return sum + subtotal + vat;
    }, 0);

    const totalVendorPaid = vendorPayments.reduce((s, p) => s + Number(p.amount), 0);

    const totalBudgetAllocated = budgets.reduce((s, b) => s + Number(b.allocatedAmount), 0);
    const totalBudgetSpent = budgets.reduce((s, b) => s + Number(b.spentAmount), 0);

    const totalExpenseClaims = expenses.reduce((s, e) => s + Number(e.totalAmount), 0);
    const approvedClaims = expenses.filter((e) => e.status === 'approved' || e.status === 'reimbursed');
    const pendingClaims = expenses.filter((e) => e.status === 'submitted');

    const monthlyRevenue = Array.from({ length: 12 }, (_, m) => {
      const monthInvoices = invoices.filter((inv) => new Date(inv.issueDate).getMonth() === m);
      return monthInvoices.reduce((sum, inv) => {
        const subtotal = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
        const vat = Math.round(subtotal * (inv.vatRateBps / 10000) * 100) / 100;
        return sum + (inv.totalOverrideIncVat ? Number(inv.totalOverrideIncVat) : subtotal + vat);
      }, 0);
    });

    const monthlyExpenses = Array.from({ length: 12 }, (_, m) => {
      const monthBills = vendorBills.filter((b) => new Date(b.issueDate).getMonth() === m);
      return monthBills.reduce((sum, bill) => {
        const subtotal = bill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
        const vat = Math.round(subtotal * (bill.vatRateBps / 10000) * 100) / 100;
        return sum + subtotal + vat;
      }, 0);
    });

    return NextResponse.json({
      year,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        outstandingReceivables: Math.round((totalRevenue - totalReceived) * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalVendorPaid: Math.round(totalVendorPaid * 100) / 100,
        outstandingPayables: Math.round((totalExpenses - totalVendorPaid) * 100) / 100,
        netIncome: Math.round((totalRevenue - totalExpenses) * 100) / 100,
        budgetAllocated: Math.round(totalBudgetAllocated * 100) / 100,
        budgetSpent: Math.round(totalBudgetSpent * 100) / 100,
        budgetUtilization: totalBudgetAllocated > 0
          ? Math.round((totalBudgetSpent / totalBudgetAllocated) * 10000) / 100
          : 0,
        expenseClaimsTotal: Math.round(totalExpenseClaims * 100) / 100,
        expenseClaimsPending: pendingClaims.length,
        expenseClaimsApproved: approvedClaims.length,
      },
      monthlyRevenue: monthlyRevenue.map((v) => Math.round(v * 100) / 100),
      monthlyExpenses: monthlyExpenses.map((v) => Math.round(v * 100) / 100),
      monthlyNetIncome: monthlyRevenue.map((r, i) => Math.round((r - (monthlyExpenses[i] ?? 0)) * 100) / 100),
      invoiceStatusBreakdown: {
        unpaid: invoices.filter((i) => i.status === 'unpaid').length,
        partial: invoices.filter((i) => i.status === 'partial').length,
        paid: invoices.filter((i) => i.status === 'paid').length,
      },
      vendorBillStatusBreakdown: {
        unpaid: vendorBills.filter((b) => b.status === 'unpaid').length,
        partial: vendorBills.filter((b) => b.status === 'partial').length,
        paid: vendorBills.filter((b) => b.status === 'paid').length,
      },
    });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/finance/reports',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate financial report.' }, { status: 500 });
    }
  });
}
