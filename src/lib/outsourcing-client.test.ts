import { describe, expect, it } from 'vitest';
import {
  computeRateCardBillTotal,
  computeRateCardLineAmount,
  DEFAULT_OUTSOURCING_REPORT_SECTIONS,
  parseClientBody,
  parseRateCardLines,
  parseReportRecipientEmails,
  parseReportSections,
} from '@/lib/outsourcing-client';

describe('outsourcing-client', () => {
  it('defaults report sections when missing', () => {
    expect(parseReportSections(undefined)).toEqual(DEFAULT_OUTSOURCING_REPORT_SECTIONS);
    expect(parseReportSections(['attendance', 'invalid'])).toEqual(['attendance']);
  });

  it('parses report recipient emails', () => {
    expect(parseReportRecipientEmails(['a@x.com', 'a@x.com', ' '])).toEqual(['a@x.com']);
  });

  it('parses client body with branding fields', () => {
    const parsed = parseClientBody({
      name: 'Text Book Centre',
      status: 'active',
      whiteLabelReports: true,
      reportRecipientEmails: ['hr@tbc.co.ke'],
      reportSections: ['workforce', 'attendance'],
      clientLogoUrl: 'https://example.com/logo.png',
    });

    expect(parsed.name).toBe('Text Book Centre');
    expect(parsed.status).toBe('active');
    expect(parsed.whiteLabelReports).toBe(true);
    expect(parsed.reportRecipientEmails).toEqual(['hr@tbc.co.ke']);
    expect(parsed.reportSections).toEqual(['workforce', 'attendance']);
    expect(parsed.clientLogoUrl).toBe('https://example.com/logo.png');
  });

  it('parses rate card lines', () => {
    const lines = parseRateCardLines([
      {
        serviceKey: 'per_head',
        label: 'Per employee / month',
        pricingModel: 'per_head',
        unitAmount: 3500,
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.unitAmount).toBe(3500);
  });

  it('computes rate card billing amounts', () => {
    const perHead = { pricingModel: 'per_head' as const, unitAmount: '4000', percentageBps: null };
    expect(computeRateCardLineAmount(perHead, { headcount: 30 })).toBe(120_000);
    expect(
      computeRateCardBillTotal([perHead], { headcount: 30, payrollGrossTotal: 500_000 }),
    ).toBe(120_000);
  });
});
