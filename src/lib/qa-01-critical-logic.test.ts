/**
 * RAV-280 — QA-01 golden-case suite for load-bearing commercial logic.
 * CI fails on any drift in payroll, entitlements, BSC scoring, or billing.
 */
import { describe, expect, it } from 'vitest';

import {
  buildPayrollInvoiceLines,
  buildRecurringBillLines,
  computeServiceFeeExVat,
} from '@/lib/accounts/billing-automation';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { DEFAULT_KENYA_STATUTORY_RATES } from '@/lib/country-config';
import {
  allModulesAdminEnabled,
  resolveEffectiveModules,
} from '@/lib/modules';
import { computeBscFinalScore, computeWeightedAverage } from '@/lib/performance/scoring/compute-bsc-score';
import {
  computeRateCardBillTotal,
  computeRateCardLineAmount,
} from '@/lib/outsourcing-client';
import { resolvePricingBand } from '@/lib/pricing-bands';

const R = DEFAULT_KENYA_STATUTORY_RATES;

describe('QA-01 payroll statutory golden cases', () => {
  function statutory(gross: number) {
    return calculateStatutoryForPayroll('none', gross, 0, 0, R);
  }

  it('KES 50,000 gross — published walkthrough', () => {
    const r = statutory(50_000);
    expect(r.nssf).toBe(3_000);
    expect(r.nhif).toBe(1_375);
    expect(r.ahl).toBe(750);
    expect(r.paye).toBe(5_845.85);
    expect(r.netPay).toBe(39_029.15);
  });

  it('KES 100,000 gross — published walkthrough', () => {
    const r = statutory(100_000);
    expect(r.nssf).toBe(6_000);
    expect(r.paye).toBe(19_308.35);
    expect(r.netPay).toBe(70_441.65);
  });

  it('NSSF caps at 6,480 for high earners', () => {
    expect(statutory(200_000).nssf).toBe(6_480);
  });
});

describe('QA-01 entitlement resolution (effectiveModule formula)', () => {
  const adminOn = allModulesAdminEnabled();

  it('requires license ∧ entitled ∧ admin ∧ active account', () => {
    const entitled = resolveEffectiveModules(adminOn, {
      accountStatus: 'active',
      subscribedModules: { core: true, ats: true, fleet: true },
      verticalEnginesAllowed: true,
    });
    expect(entitled.core).toBe(true);
    expect(entitled.ats).toBe(true);
    expect(entitled.fleet).toBe(true);
  });

  it('blocks optional modules when not entitled', () => {
    const entitled = resolveEffectiveModules(adminOn, {
      accountStatus: 'active',
      subscribedModules: { core: true, ats: false },
      verticalEnginesAllowed: true,
    });
    expect(entitled.ats).toBe(false);
    expect(entitled.core).toBe(true);
  });

  it('blocks all modules when account suspended or churned', () => {
    for (const status of ['suspended', 'churned'] as const) {
      const entitled = resolveEffectiveModules(adminOn, {
        accountStatus: status,
        subscribedModules: { core: true, ats: true },
        verticalEnginesAllowed: true,
      });
      expect(entitled.core).toBe(false);
      expect(entitled.ats).toBe(false);
    }
  });

  it('gates vertical engines when plan disallows', () => {
    const entitled = resolveEffectiveModules(adminOn, {
      accountStatus: 'active',
      subscribedModules: { core: true, fleet: true },
      verticalEnginesAllowed: false,
    });
    expect(entitled.fleet).toBe(false);
    expect(entitled.core).toBe(true);
  });
});

describe('QA-01 BSC scorecard scoring', () => {
  it('weighted results average', () => {
    expect(
      computeWeightedAverage([
        { score: 4, weightPercent: 60 },
        { score: 5, weightPercent: 40 },
      ]),
    ).toBe(4.4);
  });

  it('blends results and competencies with cycle weights', () => {
    expect(
      computeBscFinalScore({
        resultsScore: 4,
        competenciesScore: 3,
        resultsWeightPercent: 70,
        competenciesWeightPercent: 30,
      }),
    ).toBe(3.7);
  });
});

describe('QA-01 billing golden cases', () => {
  it('per-employee service fee = headcount × rate', () => {
    expect(
      computeServiceFeeExVat(
        { serviceFeeType: 'per_employee', serviceFeeAmount: 2_500, paymentTerms: null, currency: 'KES' },
        40,
      ),
    ).toBe(100_000);
  });

  it('payroll pass-through invoice includes net + NITA + management fee', () => {
    const lines = buildPayrollInvoiceLines({
      month: 4,
      year: 2026,
      headcount: 2,
      profile: {
        serviceFeeType: 'per_employee',
        serviceFeeAmount: 1_000,
        paymentTerms: 'Net 30',
        currency: 'KES',
      },
      payrollRows: [
        { grossPay: 50_000, netPay: 42_000, nita: 50 },
        { grossPay: 60_000, netPay: 50_000, nita: 50 },
      ],
    });
    expect(lines[0]?.amountExVat).toBe(92_000);
    expect(lines.some((l) => l.item.includes('NITA'))).toBe(true);
    expect(lines.some((l) => l.item.includes('management fee'))).toBe(true);
  });

  it('recurring headcount bill', () => {
    const lines = buildRecurringBillLines({
      month: 6,
      year: 2026,
      headcount: 10,
      profile: {
        serviceFeeType: 'per_employee',
        serviceFeeAmount: 500,
        paymentTerms: null,
        currency: 'KES',
      },
    });
    expect(lines[0]?.amountExVat).toBe(5_000);
  });

  it('rate card per_head + flat + percentage markup', () => {
    const lines = [
      { pricingModel: 'per_head' as const, unitAmount: '3500', percentageBps: null },
      { pricingModel: 'flat' as const, unitAmount: '15000', percentageBps: null },
      { pricingModel: 'percentage' as const, unitAmount: '0', percentageBps: 500 },
    ];
    expect(computeRateCardLineAmount(lines[0]!, { headcount: 25 })).toBe(87_500);
    expect(computeRateCardLineAmount(lines[1]!, { headcount: 25 })).toBe(15_000);
    expect(computeRateCardLineAmount(lines[2]!, { headcount: 25, payrollGrossTotal: 1_000_000 })).toBe(
      50_000,
    );
    expect(computeRateCardBillTotal(lines, { headcount: 25, payrollGrossTotal: 1_000_000 })).toBe(
      152_500,
    );
  });
});

describe('QA-01 pricing band resolution', () => {
  it('maps headcount to standard bands', () => {
    expect(resolvePricingBand(25).id).toBe('starter');
    expect(resolvePricingBand(100).id).toBe('growth');
    expect(resolvePricingBand(300).id).toBe('business');
    expect(resolvePricingBand(600).id).toBe('enterprise');
  });
});
