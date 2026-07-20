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

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const params = request.nextUrl.searchParams;
    const clientId =
      params.get('clientId')?.trim() ||
      params.get('accountsClientId')?.trim() ||
      undefined;
    const q = params.get('q')?.trim() || undefined;
    const decisionMakerParam = params.get('decisionMaker')?.trim().toLowerCase();
    const decisionMakerOnly =
      decisionMakerParam === '1' || decisionMakerParam === 'true' || decisionMakerParam === 'yes';

    try {
      const contacts = await ctx.run((tx) =>
        tx.salesContact.findMany({
          where: {
            ...ctx.where(),
            ...(clientId ? { accountsClientId: clientId } : {}),
            ...(decisionMakerOnly ? { isDecisionMaker: true } : {}),
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { title: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q, mode: 'insensitive' } },
                    { accountsClient: { name: { contains: q, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          include: {
            accountsClient: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
          take: 500,
        }),
      );

      return NextResponse.json({ contacts: contacts.map(mapContact) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/contacts',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load contacts.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const accountsClientId =
      typeof body.accountsClientId === 'string' ? body.accountsClientId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!accountsClientId || !name) {
      return NextResponse.json(
        { error: 'accountsClientId and name are required.' },
        { status: 400 },
      );
    }

    try {
      const contact = await ctx.run(async (tx) => {
        const client = await tx.accountsClient.findFirst({
          where: { id: accountsClientId, ...ctx.where() },
          select: { id: true },
        });
        if (!client) {
          throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });
        }

        return tx.salesContact.create({
          data: {
            organizationId: ctx.organizationId,
            accountsClientId,
            name,
            title: typeof body.title === 'string' ? body.title.trim() || null : null,
            email: typeof body.email === 'string' ? body.email.trim() || null : null,
            phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
            isDecisionMaker: body.isDecisionMaker === true,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          },
          include: {
            accountsClient: { select: { id: true, name: true } },
          },
        });
      });

      return NextResponse.json({ contact: mapContact(contact) }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Accounts client not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'POST /api/sales/contacts',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create contact.' }, { status: 500 });
    }
  });
}
