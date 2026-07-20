import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { OPEN_PIPELINE_STAGES, type SalesDealStage } from '@/lib/sales/schema';

export const dynamic = 'force-dynamic';

function employeeName(e: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!e) return null;
  const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  return name || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const data = await ctx.run(async (tx) => {
        const client = await tx.accountsClient.findFirst({
          where: { id, ...ctx.where() },
          select: { id: true, name: true, type: true, currency: true, contactName: true, contactEmail: true, contactPhone: true },
        });
        if (!client) return null;

        const [deals, contacts, invoices] = await Promise.all([
          tx.salesDeal.findMany({
            where: ctx.where({ accountsClientId: id }),
            select: {
              id: true,
              name: true,
              stage: true,
              value: true,
              currency: true,
              probability: true,
              forecastCategory: true,
              expectedCloseDate: true,
              closedAt: true,
              lastActivityAt: true,
              accountsInvoiceId: true,
              owner: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 200,
          }),
          tx.salesContact.findMany({
            where: ctx.where({ accountsClientId: id }),
            select: {
              id: true,
              name: true,
              title: true,
              email: true,
              phone: true,
              isDecisionMaker: true,
              lastContactedAt: true,
            },
            orderBy: [{ isDecisionMaker: 'desc' }, { name: 'asc' }],
            take: 200,
          }),
          tx.accountsInvoice.findMany({
            where: ctx.where({ clientId: id }),
            select: {
              id: true,
              invoiceNumber: true,
              issueDate: true,
              dueDate: true,
              currency: true,
              status: true,
              vatRateBps: true,
              totalOverrideIncVat: true,
              lines: { select: { amountExVat: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: 100,
          }),
        ]);

        const dealIds = deals.map((d) => d.id);
        const activities =
          dealIds.length > 0
            ? await tx.salesDealActivity.findMany({
                where: ctx.where({ dealId: { in: dealIds } }),
                select: {
                  id: true,
                  type: true,
                  subject: true,
                  body: true,
                  createdAt: true,
                  dealId: true,
                  actor: { select: { id: true, firstName: true, lastName: true } },
                  deal: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
              })
            : [];

        return { client, deals, contacts, invoices, activities };
      });

      if (!data) {
        return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
      }

      const { client, deals, contacts, invoices, activities } = data;

      const dealsJson = deals.map((d) => ({
        id: d.id,
        name: d.name,
        stage: d.stage,
        value: Number(d.value),
        currency: d.currency,
        probability: d.probability,
        forecastCategory: d.forecastCategory,
        expectedCloseDate: d.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
        closedAt: d.closedAt?.toISOString() ?? null,
        lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
        accountsInvoiceId: d.accountsInvoiceId,
        owner: d.owner ? { id: d.owner.id, name: employeeName(d.owner) } : null,
      }));

      const contactsJson = contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isDecisionMaker: c.isDecisionMaker,
        lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
      }));

      const invoicesJson = invoices.map((inv) => {
        const computed = computeInvoiceVatFromLines(inv.lines, inv.vatRateBps);
        const amount =
          inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : computed.totalIncVat;
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate.toISOString().slice(0, 10),
          dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
          currency: inv.currency,
          status: inv.status,
          amount,
        };
      });

      const activitiesJson = activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        dealId: a.dealId,
        dealName: a.deal?.name ?? null,
        actor: a.actor ? { id: a.actor.id, name: employeeName(a.actor) } : null,
      }));

      const isOpen = (stage: string) => OPEN_PIPELINE_STAGES.includes(stage as SalesDealStage);
      const openDeals = dealsJson.filter((d) => isOpen(d.stage));
      const openPipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);
      const weightedPipelineValue = openDeals.reduce(
        (sum, d) => sum + d.value * (Math.min(100, Math.max(0, d.probability)) / 100),
        0,
      );
      const wonValue = dealsJson
        .filter((d) => d.stage === 'won')
        .reduce((sum, d) => sum + d.value, 0);
      const outstandingInvoiceTotal = invoicesJson
        .filter((inv) => inv.status !== 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0);

      const round2 = (n: number) => Math.round(n * 100) / 100;

      return NextResponse.json({
        account: {
          id: client.id,
          name: client.name,
          type: client.type,
          currency: client.currency,
          contactName: client.contactName,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
        },
        kpis: {
          openPipelineValue: round2(openPipelineValue),
          weightedPipelineValue: round2(weightedPipelineValue),
          wonValue: round2(wonValue),
          openDealsCount: openDeals.length,
          contactsCount: contactsJson.length,
          outstandingInvoiceTotal: round2(outstandingInvoiceTotal),
        },
        deals: dealsJson,
        contacts: contactsJson,
        activities: activitiesJson,
        invoices: invoicesJson,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/accounts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load account.' }, { status: 500 });
    }
  });
}
