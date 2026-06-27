import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function GET(_request: NextRequest) {
  return withAccountsTenant(_request, async (ctx) => {
    try {
      const rows = await ctx.run((tx) =>
        tx.accountsVendor.findMany({
          where: { organizationId: ctx.organizationId },
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            currency: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { bills: true, payments: true } },
          },
          orderBy: { name: 'asc' },
          take: 500,
        }),
      );

      const vendors = rows.map((v) => ({
        id: v.id,
        name: v.name,
        contactName: v.contactName,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        currency: v.currency,
        notes: v.notes,
        counts: { bills: v._count.bills, payments: v._count.payments },
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      }));

      return NextResponse.json({ vendors });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/accounts/vendors',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load vendors.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role);
    if (!access.canManageVendors) {
      return NextResponse.json({ error: 'You do not have permission to manage vendors.' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const name = str(b.name);
    if (!name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }

    const currency = (str(b.currency) ?? 'KES').trim() || 'KES';
    const contactName = str(b.contactName);
    const contactEmail = str(b.contactEmail);
    const contactPhone = str(b.contactPhone);
    const notes = b.notes != null && typeof b.notes === 'string' ? b.notes.trim() || null : null;

    try {
      const v = await ctx.run((tx) =>
        tx.accountsVendor.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            currency,
            contactName,
            contactEmail,
            contactPhone,
            notes,
          },
          select: { id: true },
        }),
      );
      return NextResponse.json({ id: v.id }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/accounts/vendors',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create vendor.' }, { status: 500 });
    }
  });
}
