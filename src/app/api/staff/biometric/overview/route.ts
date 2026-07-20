import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_POLL_MS = DAY_MS;

/** GET /api/staff/biometric/overview — org-wide device fleet health metrics. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since7d = new Date(now.getTime() - 7 * DAY_MS);

    const payload = await ctx.run(async (tx) => {
      const devices = await tx.staffBiometricDevice.findMany({
        where: ctx.where(),
        select: { id: true, isActive: true, adapterKind: true, lastPollAt: true },
      });

      const totalDevices = devices.length;
      const activeDevices = devices.filter((d) => d.isActive).length;
      const staleDevices = devices.filter(
        (d) =>
          d.isActive &&
          d.adapterKind === 'hikvision_isapi' &&
          (!d.lastPollAt || d.lastPollAt.getTime() < now.getTime() - STALE_POLL_MS),
      ).length;

      const lastPollAt = devices.reduce<Date | null>((acc, d) => {
        if (!d.lastPollAt) return acc;
        if (!acc || d.lastPollAt.getTime() > acc.getTime()) return d.lastPollAt;
        return acc;
      }, null);

      const [punches24h, punches7d, totalPunches, unmatchedPunches, lastPunch] = await Promise.all([
        tx.staffBiometricPunch.count({ where: ctx.where({ observedAt: { gte: since24h } }) }),
        tx.staffBiometricPunch.count({ where: ctx.where({ observedAt: { gte: since7d } }) }),
        tx.staffBiometricPunch.count({ where: ctx.where() }),
        tx.staffBiometricPunch.count({ where: ctx.where({ userId: null }) }),
        tx.staffBiometricPunch.findFirst({
          where: ctx.where(),
          orderBy: { observedAt: 'desc' },
          select: { observedAt: true },
        }),
      ]);

      const matchedRate =
        totalPunches > 0 ? Math.round(((totalPunches - unmatchedPunches) / totalPunches) * 100) : 0;

      return {
        totalDevices,
        activeDevices,
        inactiveDevices: totalDevices - activeDevices,
        staleDevices,
        lastPollAt: lastPollAt?.toISOString() ?? null,
        lastObservedAt: lastPunch?.observedAt?.toISOString() ?? null,
        punches24h,
        punches7d,
        totalPunches,
        unmatchedPunches,
        matchedRate,
      };
    });

    return NextResponse.json(payload);
  });
}
