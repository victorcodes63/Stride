import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import {
  mapOutsourcingClientToJson,
  parseRateCardLines,
  type OutsourcingRateCardJson,
} from '@/lib/outsourcing-client';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function str(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  return typeof v === 'string' ? v.trim() || null : null;
}

function dateOnly(b: Record<string, unknown>, key: string): Date | null {
  const v = str(b, key);
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapRateCard(card: {
  id: string;
  name: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  lines: Array<{
    id: string;
    serviceKey: string;
    label: string;
    pricingModel: string;
    unitAmount: unknown;
    percentageBps: number | null;
    sortOrder: number;
  }>;
}): OutsourcingRateCardJson {
  return {
    id: card.id,
    name: card.name,
    effectiveFrom: card.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: card.effectiveTo?.toISOString().slice(0, 10) ?? null,
    currency: card.currency,
    notes: card.notes,
    isActive: card.isActive,
    lines: card.lines.map((line) => ({
      id: line.id,
      serviceKey: line.serviceKey as OutsourcingRateCardJson['lines'][number]['serviceKey'],
      label: line.label,
      pricingModel: line.pricingModel as OutsourcingRateCardJson['lines'][number]['pricingModel'],
      unitAmount: line.unitAmount != null ? String(line.unitAmount) : '0',
      percentageBps: line.percentageBps,
      sortOrder: line.sortOrder,
    })),
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(_request, async (ctx) => {
    const client = await ctx.run((tx) =>
      tx.outsourcingClient.findFirst({
        where: { id: clientId, organizationId: ctx.organizationId },
        select: { id: true },
      }),
    );
    if (!client) return forbiddenResponse('Client not found for this organization.');

    const cards = await ctx.run((tx) =>
      tx.outsourcingRateCard.findMany({
        where: { outsourcingClientId: clientId, organizationId: ctx.organizationId },
        orderBy: { effectiveFrom: 'desc' },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      }),
    );

    return NextResponse.json(cards.map(mapRateCard));
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const effectiveFrom = dateOnly(b, 'effectiveFrom');
  const lines = parseRateCardLines(b.lines);
  if (!effectiveFrom) {
    return NextResponse.json({ error: 'effectiveFrom is required.' }, { status: 400 });
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Add at least one rate line.' }, { status: 400 });
  }

  const isActive = b.isActive !== false;
  const effectiveTo = dateOnly(b, 'effectiveTo');
  const currency = str(b, 'currency') ?? 'KES';

  return withTenant(request, async (ctx) => {
    const client = await ctx.run((tx) =>
      tx.outsourcingClient.findFirst({
        where: { id: clientId, organizationId: ctx.organizationId },
        select: { id: true, currency: true },
      }),
    );
    if (!client) return forbiddenResponse('Client not found for this organization.');

    const card = await ctx.run(async (tx) => {
      if (isActive) {
        await tx.outsourcingRateCard.updateMany({
          where: { outsourcingClientId: clientId, organizationId: ctx.organizationId, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.outsourcingRateCard.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
          name: str(b, 'name'),
          effectiveFrom,
          effectiveTo,
          currency: currency || client.currency || 'KES',
          notes: str(b, 'notes'),
          isActive,
          lines: {
            create: lines.map((line, index) => ({
              organizationId: ctx.organizationId,
              serviceKey: line.serviceKey,
              label: line.label,
              pricingModel: line.pricingModel,
              unitAmount: line.unitAmount,
              percentageBps: line.percentageBps ?? null,
              sortOrder: line.sortOrder ?? index,
            })),
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    const refreshed = await ctx.run((tx) =>
      tx.outsourcingClient.findFirst({
        where: { id: clientId },
        include: {
          _count: { select: { employees: true, departments: true } },
          rateCards: {
            orderBy: { effectiveFrom: 'desc' },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
    );

    return NextResponse.json({
      rateCard: mapRateCard(card),
      client: refreshed ? mapOutsourcingClientToJson(refreshed) : null,
    });
  });
}
