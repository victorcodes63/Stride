import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const rows = await prisma.fleetTransportPartner.findMany({
      where: fleetTenantWhere(ctx),
      include: { _count: { select: { trips: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        contactName: row.contactName,
        contactPhone: row.contactPhone,
        contactEmail: row.contactEmail,
        payoutDetails: row.payoutDetails,
        tripCount: row._count.trips,
        notes: row.notes,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }

    const row = await prisma.fleetTransportPartner.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        name,
        contactName:
          typeof body?.contactName === 'string' ? body.contactName.trim() || null : null,
        contactPhone:
          typeof body?.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
        contactEmail:
          typeof body?.contactEmail === 'string' ? body.contactEmail.trim() || null : null,
        payoutDetails:
          typeof body?.payoutDetails === 'string' ? body.payoutDetails.trim() || null : null,
        notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
      },
    });

    return NextResponse.json({ id: row.id, name: row.name }, { status: 201 });
  });
}
