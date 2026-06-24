import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';
import { parseEntitlementsCookie } from '@/lib/entitlements-cookie';
import { prisma } from '@/lib/prisma';

export type SeatLimitCheck = {
  limit: number | null;
  active: number;
  remaining: number | null;
};

export function seatLimitExceededPayload(check: SeatLimitCheck) {
  return {
    error: `Seat limit reached (${check.active}/${check.limit}). Upgrade your plan to add more employees.`,
    code: 'SEAT_LIMIT_EXCEEDED' as const,
    seatLimit: check.limit,
    activeEmployees: check.active,
  };
}

export async function countBillableEmployees(
  outsourcingClientId?: string,
): Promise<number> {
  return prisma.employee.count({
    where: {
      ...(outsourcingClientId ? { outsourcingClientId } : {}),
      employmentStatus: { in: ['active', 'probation'] },
    },
  });
}

export async function getEntitlementsForSeatCheck(
  request?: NextRequest,
): Promise<DeploymentEntitlements | null> {
  if (request) {
    const fromCookie = parseEntitlementsCookie(
      request.cookies.get('hris_entitlements')?.value,
    );
    if (fromCookie) return fromCookie;
  }
  return loadDeploymentEntitlements();
}

export async function checkSeatLimitForNewEmployee(
  outsourcingClientId: string,
  request?: NextRequest,
): Promise<{ ok: true; check: SeatLimitCheck } | { ok: false; check: SeatLimitCheck }> {
  const entitlements = await getEntitlementsForSeatCheck(request);
  const limit = entitlements?.seatLimit ?? null;
  const active = await countBillableEmployees(outsourcingClientId);

  const check: SeatLimitCheck = {
    limit,
    active,
    remaining: limit != null ? Math.max(0, limit - active) : null,
  };

  if (limit == null || limit <= 0) {
    return { ok: true, check };
  }

  if (active >= limit) {
    return { ok: false, check };
  }

  return { ok: true, check };
}

export async function reportSeatUsageToControlPlane(
  activeEmployees: number,
): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_URL?.trim();
  const slug = process.env.CONTROL_PLANE_CUSTOMER_SLUG?.trim();
  if (!baseUrl || !slug) return;

  const apiKey = process.env.CONTROL_PLANE_INSTANCE_API_KEY?.trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/usage`;
  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ slug, activeEmployees }),
  }).catch(() => undefined);
}
