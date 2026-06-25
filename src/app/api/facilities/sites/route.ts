import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateSiteCode } from '@/lib/facilities/site-code';
import { serializeSite } from '@/lib/facilities/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const [sites, activeCount, openTickets] = await Promise.all([
      prisma.facilitySite.findMany({
        where: {
          outsourcingClientId: clientId,
          ...(status ? { status: status as never } : {}),
        },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { leases: true, maintenanceTickets: true } },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        take: 200,
      }),
      prisma.facilitySite.count({
        where: { outsourcingClientId: clientId, status: 'active' },
      }),
      prisma.facilityMaintenanceTicket.count({
        where: {
          outsourcingClientId: clientId,
          status: { in: ['open', 'in_progress', 'on_hold'] },
        },
      }),
    ]);

    return NextResponse.json({
      sites: sites.map(serializeSite),
      summary: {
        total: sites.length,
        active: activeCount,
        openTickets,
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/facilities/sites',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load sites.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Site name is required.' }, { status: 400 });

  const siteType =
    typeof body.siteType === 'string' &&
    ['office', 'warehouse', 'retail', 'site', 'other'].includes(body.siteType)
      ? body.siteType
      : 'office';
  const status =
    typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)
      ? body.status
      : 'active';
  const address = typeof body.address === 'string' ? body.address.trim() : null;
  const county = typeof body.county === 'string' ? body.county.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
  const managerUserId = typeof body.managerUserId === 'string' ? body.managerUserId.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const siteCode = await allocateSiteCode(prisma, clientId);

    const created = await prisma.facilitySite.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        siteCode,
        name,
        siteType: siteType as never,
        status: status as never,
        address,
        county,
        phone,
        notes,
        managerUserId: managerUserId || null,
        createdByUserId: user.id,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { leases: true, maintenanceTickets: true } },
      },
    });

    return NextResponse.json({ site: serializeSite(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/facilities/sites',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create site.' }, { status: 500 });
  }
}
