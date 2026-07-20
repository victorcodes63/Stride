import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/staff/biometric/punches — recent punch stream with filters.
 *
 * Query: `deviceId`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `match`
 * (all|matched|unmatched), `search` (rawSubjectId), `limit`.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const sp = request.nextUrl.searchParams;
    const deviceId = sp.get('deviceId')?.trim() || undefined;
    const from = sp.get('from')?.trim() || undefined;
    const to = sp.get('to')?.trim() || undefined;
    const match = sp.get('match')?.trim() || 'all';
    const search = sp.get('search')?.trim() || undefined;
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get('limit') ?? '', 10) || DEFAULT_LIMIT));

    const observedAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(`${from}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) observedAt.gte = d;
    }
    if (to) {
      const d = new Date(`${to}T23:59:59.999Z`);
      if (!Number.isNaN(d.getTime())) observedAt.lte = d;
    }

    const filters: Prisma.StaffBiometricPunchWhereInput = {};
    if (deviceId) filters.staffBiometricDeviceId = deviceId;
    if (observedAt.gte || observedAt.lte) filters.observedAt = observedAt;
    if (match === 'matched') filters.userId = { not: null };
    else if (match === 'unmatched') filters.userId = null;
    if (search) filters.rawSubjectId = { contains: search, mode: 'insensitive' };

    const payload = await ctx.run(async (tx) => {
      const rows = await tx.staffBiometricPunch.findMany({
        where: ctx.where(filters),
        orderBy: { observedAt: 'desc' },
        take: limit,
        include: {
          device: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        deviceId: row.staffBiometricDeviceId,
        deviceName: row.device?.name ?? '—',
        observedAt: row.observedAt.toISOString(),
        rawSubjectId: row.rawSubjectId,
        direction: row.direction,
        source: row.source,
        userId: row.userId,
        userName: row.user?.name ?? null,
        userEmail: row.user?.email ?? null,
      }));
    });

    return NextResponse.json({ punches: payload, count: payload.length, limit });
  });
}
