import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function mapContact(c: {
  id: string;
  accountsClientId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isDecisionMaker: boolean;
  lastContactedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  accountsClient?: { id: string; name: string } | null;
}) {
  return {
    id: c.id,
    accountsClientId: c.accountsClientId,
    accountsClient: c.accountsClient ?? null,
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    isDecisionMaker: c.isDecisionMaker,
    lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const contact = await ctx.run((tx) =>
        tx.salesContact.findFirst({
          where: { id, ...ctx.where() },
          include: { accountsClient: { select: { id: true, name: true } } },
        }),
      );

      if (!contact) {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
      }

      return NextResponse.json({ contact: mapContact(contact) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/contacts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load contact.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const contact = await ctx.run(async (tx) => {
        const existing = await tx.salesContact.findFirst({
          where: { id, ...ctx.where() },
          select: { id: true },
        });
        if (!existing) {
          throw Object.assign(new Error('CONTACT_NOT_FOUND'), { code: 'CONTACT_NOT_FOUND' });
        }

        // Optional account re-assignment — must belong to the same org.
        let accountsClientId: string | undefined;
        if (typeof body.accountsClientId === 'string' && body.accountsClientId.trim()) {
          const nextClientId = body.accountsClientId.trim();
          const client = await tx.accountsClient.findFirst({
            where: { id: nextClientId, ...ctx.where() },
            select: { id: true },
          });
          if (!client) {
            throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });
          }
          accountsClientId = nextClientId;
        }

        const data: Record<string, unknown> = {};
        if (accountsClientId) data.accountsClientId = accountsClientId;
        if (typeof body.name === 'string') {
          const name = body.name.trim();
          if (!name) {
            throw Object.assign(new Error('NAME_REQUIRED'), { code: 'NAME_REQUIRED' });
          }
          data.name = name;
        }
        if ('title' in body)
          data.title = typeof body.title === 'string' ? body.title.trim() || null : null;
        if ('email' in body)
          data.email = typeof body.email === 'string' ? body.email.trim() || null : null;
        if ('phone' in body)
          data.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
        if ('notes' in body)
          data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
        if ('isDecisionMaker' in body) data.isDecisionMaker = body.isDecisionMaker === true;
        if ('lastContactedAt' in body) {
          data.lastContactedAt =
            typeof body.lastContactedAt === 'string' && body.lastContactedAt
              ? new Date(body.lastContactedAt)
              : null;
        }

        return tx.salesContact.update({
          where: { id },
          data,
          include: { accountsClient: { select: { id: true, name: true } } },
        });
      });

      return NextResponse.json({ contact: mapContact(contact) });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CONTACT_NOT_FOUND') {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
      }
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Accounts client not found.' }, { status: 404 });
      }
      if (err.code === 'NAME_REQUIRED') {
        return NextResponse.json({ error: 'name cannot be empty.' }, { status: 400 });
      }
      await reportApiError({
        route: 'PATCH /api/sales/contacts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update contact.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      await ctx.run(async (tx) => {
        const existing = await tx.salesContact.findFirst({
          where: { id, ...ctx.where() },
          select: { id: true },
        });
        if (!existing) {
          throw Object.assign(new Error('CONTACT_NOT_FOUND'), { code: 'CONTACT_NOT_FOUND' });
        }
        await tx.salesContact.delete({ where: { id } });
      });

      return NextResponse.json({ ok: true });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CONTACT_NOT_FOUND') {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'DELETE /api/sales/contacts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete contact.' }, { status: 500 });
    }
  });
}
