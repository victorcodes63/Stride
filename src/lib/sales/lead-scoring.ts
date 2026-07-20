/**
 * Sales Performance — lead scoring engine (pure, testable).
 *
 * Produces a 0-100 score from firmographic completeness, source quality,
 * estimated value, and recency of engagement, plus a hot/warm/cold rating.
 */

import type { SalesLeadRating } from '@/lib/sales/schema';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type LeadScoreInput = {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: string | null;
  estimatedValue?: number | null;
  lastActivityAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type LeadScoreBreakdown = {
  label: string;
  points: number;
  max: number;
};

export type LeadScoreResult = {
  score: number;
  rating: SalesLeadRating;
  breakdown: LeadScoreBreakdown[];
};

/** Higher-intent sources score better. Keys are matched case-insensitively. */
const SOURCE_WEIGHTS: Record<string, number> = {
  referral: 15,
  'existing customer': 15,
  partner: 12,
  inbound: 12,
  website: 10,
  webform: 10,
  event: 9,
  'trade show': 9,
  campaign: 7,
  outbound: 6,
  'cold call': 4,
  'list purchase': 2,
};

function daysSince(value: string | Date | null | undefined, now: Date): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, (now.getTime() - d.getTime()) / MS_PER_DAY);
}

function sourceScore(source: string | null | undefined): number {
  if (!source) return 0;
  const key = source.trim().toLowerCase();
  if (key in SOURCE_WEIGHTS) return SOURCE_WEIGHTS[key];
  for (const [name, weight] of Object.entries(SOURCE_WEIGHTS)) {
    if (key.includes(name)) return weight;
  }
  return 3;
}

/**
 * Compute a lead score (0-100) with a per-signal breakdown.
 *
 * Weighting (max points):
 *   Email present (15), Phone present (10), Company present (10),
 *   Source quality (15), Estimated value (25), Engagement recency (25).
 */
export function scoreLead(input: LeadScoreInput, now: Date = new Date()): LeadScoreResult {
  const breakdown: LeadScoreBreakdown[] = [];

  const emailPts = input.email && input.email.trim() ? 15 : 0;
  breakdown.push({ label: 'Email on file', points: emailPts, max: 15 });

  const phonePts = input.phone && input.phone.trim() ? 10 : 0;
  breakdown.push({ label: 'Phone on file', points: phonePts, max: 10 });

  const companyPts = input.company && input.company.trim() ? 10 : 0;
  breakdown.push({ label: 'Company identified', points: companyPts, max: 10 });

  const srcPts = sourceScore(input.source);
  breakdown.push({ label: 'Source quality', points: srcPts, max: 15 });

  const value = Number(input.estimatedValue ?? 0);
  let valuePts = 0;
  if (Number.isFinite(value) && value > 0) {
    // Log-ish ramp: 100k -> ~10, 1M -> ~19, 5M+ -> 25.
    valuePts = Math.min(25, Math.round((Math.log10(value) - 4) * 8 + 8));
    valuePts = Math.max(0, valuePts);
  }
  breakdown.push({ label: 'Estimated value', points: valuePts, max: 25 });

  const recencyDays = daysSince(input.lastActivityAt ?? input.createdAt, now);
  let recencyPts = 0;
  if (recencyDays != null) {
    if (recencyDays <= 2) recencyPts = 25;
    else if (recencyDays <= 7) recencyPts = 20;
    else if (recencyDays <= 14) recencyPts = 14;
    else if (recencyDays <= 30) recencyPts = 8;
    else if (recencyDays <= 60) recencyPts = 3;
    else recencyPts = 0;
  }
  breakdown.push({ label: 'Engagement recency', points: recencyPts, max: 25 });

  let score = breakdown.reduce((sum, b) => sum + b.points, 0);

  // Disqualified leads are floored; converted leads are maxed.
  if (input.status === 'disqualified') score = Math.min(score, 10);
  if (input.status === 'converted') score = 100;

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, rating: ratingFromScore(score), breakdown };
}

/** Map a 0-100 score to a rating band. */
export function ratingFromScore(score: number): SalesLeadRating {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}
