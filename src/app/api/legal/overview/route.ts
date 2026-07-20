import { NextRequest, NextResponse } from 'next/server';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  OBLIGATION_CATEGORIES,
  OBLIGATION_PRIORITIES,
  PRIORITY_WEIGHT,
  type LegalObligationCategory,
  type LegalObligationPriority,
} from '@/lib/legal/constants';

export const dynamic = 'force-dynamic';

/** Number of whole days between `asOf` and `date` (positive = future). */
function daysUntil(date: Date, asOf: Date): number {
  const a = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

/** Window (in days) used to flag contracts / credentials / policies as "expiring soon". */
const SOON_WINDOW_DAYS = 60;

export type LegalOverviewResponse = {
  generatedAt: string;
  obligations: {
    total: number;
    byStatus: { pending: number; completed: number; waived: number };
    /** Derived urgency of pending obligations (uses reminderDays, capped at 60). */
    byUrgency: { overdue: number; dueSoon: number; ok: number };
    byPriority: Record<LegalObligationPriority, number>;
    byCategory: Record<LegalObligationCategory, number>;
  };
  contracts: { total: number; expiringSoon: number };
  credentials: { total: number; alerts: number; expiring: number; expired: number };
  policies: { total: number; expiring: number };
  /** Compliance risk score 0–100 (higher = more attention needed) + banding. */
  risk: { score: number; level: 'low' | 'moderate' | 'elevated' | 'high' };
  /** 6-month look-ahead of everything coming due (obligations + contracts + credentials + policies). */
  trend: Array<{ month: string; label: string; count: number }>;
  /** Flat headline counts for stat cards. */
  stats: {
    overdueObligations: number;
    dueSoonObligations: number;
    contractsExpiring: number;
    credentialAlerts: number;
    policiesExpiring: number;
  };
};

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const asOf = new Date();

      const [contracts, credentials, policies, obligations] = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        const workspaceClientId = await resolvePrimaryWorkspaceClientId(
          tx,
          null,
          request,
          ctx.organizationId,
        );

        return Promise.all([
          tx.accountsContract.findMany({
            where: {
              ...ctx.where(),
              clientId: primaryAccountsClient.id,
            },
            select: { id: true, endDate: true },
            orderBy: { endDate: 'asc' },
            take: 500,
          }),
          tx.employeeCredential.findMany({
            where: {
              ...ctx.where(),
              employee: {
                outsourcingClientId: workspaceClientId,
                organizationId: ctx.organizationId,
              },
              expiryDate: { not: null },
              status: { in: ['active', 'expiring_soon', 'expired'] },
            },
            select: { id: true, expiryDate: true },
            orderBy: { expiryDate: 'asc' },
            take: 500,
          }),
          tx.companyDocument.findMany({
            where: {
              ...ctx.where(),
              status: { not: 'archived' },
              expiryDate: { not: null },
            },
            select: { id: true, expiryDate: true },
            orderBy: { expiryDate: 'asc' },
            take: 500,
          }),
          tx.legalObligation.findMany({
            where: ctx.where(),
            select: {
              id: true,
              status: true,
              priority: true,
              category: true,
              dueDate: true,
              reminderDays: true,
            },
            orderBy: { dueDate: 'asc' },
            take: 1000,
          }),
        ]);
      });

      // --- Obligation aggregations ---
      const byStatus = { pending: 0, completed: 0, waived: 0 };
      const byUrgency = { overdue: 0, dueSoon: 0, ok: 0 };
      const byPriority = Object.fromEntries(
        OBLIGATION_PRIORITIES.map((p) => [p, 0]),
      ) as Record<LegalObligationPriority, number>;
      const byCategory = Object.fromEntries(
        OBLIGATION_CATEGORIES.map((c) => [c, 0]),
      ) as Record<LegalObligationCategory, number>;

      let criticalPending = 0;
      let highPending = 0;

      for (const o of obligations) {
        byStatus[o.status] += 1;
        byPriority[o.priority] += 1;
        byCategory[o.category] += 1;

        if (o.status === 'pending') {
          const days = daysUntil(o.dueDate, asOf);
          const soon = Math.min(Math.max(o.reminderDays, 1), SOON_WINDOW_DAYS);
          if (days < 0) byUrgency.overdue += 1;
          else if (days <= soon) byUrgency.dueSoon += 1;
          else byUrgency.ok += 1;

          if (o.priority === 'critical') criticalPending += 1;
          else if (o.priority === 'high') highPending += 1;
        }
      }

      // --- Contract aggregations ---
      let contractsExpiring = 0;
      for (const c of contracts) {
        const days = daysUntil(c.endDate, asOf);
        if (days <= SOON_WINDOW_DAYS) contractsExpiring += 1;
      }

      // --- Credential aggregations ---
      let credentialExpiring = 0;
      let credentialExpired = 0;
      for (const cred of credentials) {
        if (!cred.expiryDate) continue;
        const days = daysUntil(cred.expiryDate, asOf);
        if (days < 0) credentialExpired += 1;
        else if (days <= SOON_WINDOW_DAYS) credentialExpiring += 1;
      }
      const credentialAlerts = credentialExpiring + credentialExpired;

      // --- Policy aggregations ---
      let policiesExpiring = 0;
      for (const p of policies) {
        if (!p.expiryDate) continue;
        const days = daysUntil(p.expiryDate, asOf);
        if (days <= SOON_WINDOW_DAYS) policiesExpiring += 1;
      }

      // --- 6-month upcoming due load trend ---
      const monthKeys: string[] = [];
      const monthIndex = new Map<string, number>();
      for (let i = 0; i < 6; i += 1) {
        const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + i, 1));
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(key);
        monthIndex.set(key, i);
      }
      const trendCounts = new Array<number>(6).fill(0);
      const addToTrend = (date: Date | null | undefined) => {
        if (!date) return;
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const idx = monthIndex.get(key);
        if (idx != null) trendCounts[idx] += 1;
      };
      for (const o of obligations) {
        if (o.status === 'pending') addToTrend(o.dueDate);
      }
      for (const c of contracts) addToTrend(c.endDate);
      for (const cred of credentials) addToTrend(cred.expiryDate);
      for (const p of policies) addToTrend(p.expiryDate);

      const trend = monthKeys.map((key, i) => {
        const [y, m] = key.split('-').map((v) => Number.parseInt(v, 10));
        const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-KE', {
          month: 'short',
          year: '2-digit',
        });
        return { month: key, label, count: trendCounts[i] };
      });

      // --- Compliance risk score (weighted, capped at 100) ---
      const rawRisk =
        byUrgency.overdue * 14 +
        byUrgency.dueSoon * 5 +
        criticalPending * PRIORITY_WEIGHT.critical * 3 +
        highPending * PRIORITY_WEIGHT.high * 2 +
        credentialAlerts * 3 +
        contractsExpiring * 2 +
        policiesExpiring * 2;
      const score = Math.min(100, Math.round(rawRisk));
      const level: LegalOverviewResponse['risk']['level'] =
        score >= 75 ? 'high' : score >= 50 ? 'elevated' : score >= 25 ? 'moderate' : 'low';

      const response: LegalOverviewResponse = {
        generatedAt: asOf.toISOString(),
        obligations: {
          total: obligations.length,
          byStatus,
          byUrgency,
          byPriority,
          byCategory,
        },
        contracts: { total: contracts.length, expiringSoon: contractsExpiring },
        credentials: {
          total: credentials.length,
          alerts: credentialAlerts,
          expiring: credentialExpiring,
          expired: credentialExpired,
        },
        policies: { total: policies.length, expiring: policiesExpiring },
        risk: { score, level },
        trend,
        stats: {
          overdueObligations: byUrgency.overdue,
          dueSoonObligations: byUrgency.dueSoon,
          contractsExpiring,
          credentialAlerts,
          policiesExpiring,
        },
      };

      return NextResponse.json(response);
    } catch (error) {
      await reportApiError({
        route: request.nextUrl?.pathname ?? '/api/legal/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load legal overview.' }, { status: 500 });
    }
  });
}
