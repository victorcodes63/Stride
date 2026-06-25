import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLease } from '@/lib/facilities/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const siteId = request.nextUrl.searchParams.get('siteId')?.trim() || undefined;
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const leases = await prisma.facilityLease.findMany({
      where: {
        site: { outsourcingClientId: clientId },
        ...(siteId ? { siteId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
      take: 200,
    });

    return NextResponse.json({ leases: leases.map(serializeLease) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/facilities/leases',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load leases.' }, { status: 500 });
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

  const siteId = typeof body.siteId === 'string' ? body.siteId.trim() : '';
  const landlordName = typeof body.landlordName === 'string' ? body.landlordName.trim() : '';
  const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
  const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';

  if (!siteId || !landlordName || !startDate || !endDate) {
    return NextResponse.json({ error: 'Site, landlord, start and end dates are required.' }, { status: 400 });
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim() : null;
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
  const monthlyRent =
    typeof body.monthlyRent === 'number' && Number.isFinite(body.monthlyRent) ? body.monthlyRent : null;
  const renewalNotes = typeof body.renewalNotes === 'string' ? body.renewalNotes.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const site = await prisma.facilitySite.findFirst({
      where: { id: siteId, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

    const created = await prisma.facilityLease.create({
      data: {
        organizationId: user.currentOrgId,
        siteId,
        reference,
        landlordName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyRent,
        currency,
        renewalNotes,
        createdByUserId: user.id,
      },
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
      },
    });

    return NextResponse.json({ lease: serializeLease(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/facilities/leases',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create lease.' }, { status: 500 });
  }
}
