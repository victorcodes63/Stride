import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const existing = await ctx.run((tx) => tx.questionBankItem.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });

    const data: Prisma.QuestionBankItemUpdateInput = {};
    if (typeof body.prompt === 'string') data.prompt = body.prompt.trim();
    if (body.options !== undefined) data.options = body.options as Prisma.InputJsonValue;
    if (body.correctAnswer !== undefined) data.correctAnswer = body.correctAnswer as Prisma.InputJsonValue;
    if (body.scoring !== undefined) data.scoring = body.scoring as Prisma.InputJsonValue;
    if (typeof body.explanation === 'string') data.explanation = body.explanation.trim() || null;
    if (typeof body.category === 'string') data.category = body.category.trim() || null;
    if (Array.isArray(body.tags)) data.tags = body.tags.map((t) => String(t)).slice(0, 20);
    if (typeof body.defaultPoints === 'number') data.defaultPoints = Math.max(0, Math.trunc(body.defaultPoints));

    const item = await ctx.run((tx) => tx.questionBankItem.update({ where: { id }, data }));
    return NextResponse.json(item);
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const existing = await ctx.run((tx) => tx.questionBankItem.findFirst({ where: ctx.where({ id }), select: { id: true } }));
    if (!existing) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    await ctx.run((tx) => tx.questionBankItem.delete({ where: { id } }));
    return NextResponse.json({ ok: true });
  });
}
