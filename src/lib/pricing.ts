/**
 * Canonical Stride plan pricing — per active employee, per month, in KES.
 *
 * Single source for rates, plan copy, calculator bounds, the free parallel-run offer
 * and the pricing FAQ. Marketing, legal and sales surfaces must read from here; no
 * price may be written out by hand anywhere else.
 *
 * Plan ids are the public names. `deploymentTier` is the runtime planId the control
 * plane pushes as `DEPLOYMENT_TIER` — Essentials maps to `starter` there, so renaming
 * the plan does not break the cross-repo entitlement contract.
 */
import type { DeploymentTier } from '@/lib/deployment-tier-shared';

export type PricingPlanId = 'essentials' | 'growth' | 'enterprise';

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  deploymentTier: DeploymentTier;
  /** KES per active employee per month. `null` when the plan is quoted per deal. */
  rateKesPerEmployee: number | null;
  /** Small label above the plan name — sizing guidance, not a cap. */
  eyebrow?: string;
  /** Shown in place of the rate when there is no published price. */
  customPriceLabel?: string;
  unit: string;
  description: string;
  /** Headcount for the illustrative example line under the price. */
  exampleEmployees?: number;
  ctaLabel: string;
  ctaIntent?: PricingIntent;
};

/** Enquiry intents carried on /contact links so the form opens on the right topic. */
export const PRICING_INTENTS = {
  parallelRun: 'parallel-run',
  enterprise: 'enterprise',
  international: 'international',
} as const;

export type PricingIntent = (typeof PRICING_INTENTS)[keyof typeof PRICING_INTENTS];

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    deploymentTier: 'starter',
    rateKesPerEmployee: 350,
    unit: 'per employee / month',
    description:
      'HR, payroll and finance for a single entity — everything a Kenyan team needs to run and file correctly.',
    exampleEmployees: 10,
    ctaLabel: 'Get a free payroll run',
    ctaIntent: PRICING_INTENTS.parallelRun,
  },
  {
    id: 'growth',
    name: 'Growth',
    deploymentTier: 'growth',
    rateKesPerEmployee: 550,
    eyebrow: 'For 50+ staff',
    unit: 'per employee / month',
    description:
      'For organisations running several functions or entities, with more modules and faster support.',
    exampleEmployees: 60,
    ctaLabel: 'Get a free payroll run',
    ctaIntent: PRICING_INTENTS.parallelRun,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    deploymentTier: 'enterprise',
    rateKesPerEmployee: null,
    customPriceLabel: 'Custom',
    unit: '150+ staff · regulated or multi-entity',
    description:
      'For regulated and multi-entity groups needing the full platform, a bespoke rollout and signed SLAs.',
    ctaLabel: 'Talk to sales',
    ctaIntent: PRICING_INTENTS.enterprise,
  },
];

/** How the billable headcount is counted — quoted verbatim in the FAQ and Terms. */
export const BILLING_UNIT_DESCRIPTION =
  'We count active employee records in a month, aggregated across all of your entities. Leavers stop counting the month after their exit date.';

export const PRICING_FOOTNOTE =
  'All plans include data migration. No setup fees. No minimums. Billed monthly in KES; cancel anytime.';

export const PRICING_CALCULATOR = {
  minEmployees: 1,
  maxEmployees: 300,
  defaultEmployees: 10,
  /** Above this headcount we quote Enterprise rather than a published rate. */
  enterpriseThreshold: 150,
  defaultPlanId: 'essentials' as PricingPlanId,
} as const;

/** First payroll cycle run free, alongside the customer's existing process. */
export const FREE_PARALLEL_RUN = {
  heading: 'Your first payroll run is on us.',
  description:
    'Before you pay anything, we prove Stride against the payroll you already trust.',
  minEmployees: 10,
  steps: [
    {
      title: 'We migrate your data',
      body: 'Employees, salaries, allowances and deductions, lifted from your current system or spreadsheets.',
    },
    {
      title: 'We run one full payroll cycle',
      body: 'A complete cycle on Stride, in parallel with your existing process — nothing is switched off.',
    },
    {
      title: 'You check every figure',
      body: 'PAYE, NSSF, SHIF, Housing Levy and net pay, line by line, against your own numbers.',
    },
  ],
} as const;

/** Kenyan payroll run for foreign employers, billed in USD. */
export const INTERNATIONAL_PRICING = {
  heading: 'Employing staff in Kenya from abroad?',
  fromUsdPerEmployee: 13,
} as const;

const PLAN_BY_ID = new Map<PricingPlanId, PricingPlan>(PRICING_PLANS.map((plan) => [plan.id, plan]));

export function getPricingPlan(planId: PricingPlanId): PricingPlan {
  const plan = PLAN_BY_ID.get(planId);
  if (!plan) throw new Error(`Unknown pricing plan: ${planId}`);
  return plan;
}

export function pricingPlanName(planId: PricingPlanId): string {
  return getPricingPlan(planId).name;
}

/** Plans with a published per-employee rate (everything except Enterprise). */
export const METERED_PRICING_PLANS: readonly PricingPlan[] = PRICING_PLANS.filter(
  (plan) => plan.rateKesPerEmployee !== null,
);

/**
 * Deterministic thousands grouping — keeps server and client markup identical, which
 * `toLocaleString` does not guarantee across ICU builds.
 */
function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatKes(amount: number): string {
  return `KES ${groupThousands(amount)}`;
}

export function formatMonthlyKes(amount: number): string {
  return `${formatKes(amount)} / month`;
}

/** Total for a month: headcount × rate. No floor, no cap, no overage. */
export function monthlyPriceKes(planId: PricingPlanId, employees: number): number | null {
  const rate = getPricingPlan(planId).rateKesPerEmployee;
  if (rate === null) return null;
  return Math.max(0, Math.round(employees)) * rate;
}

/** Muted illustration under a plan price, e.g. "e.g. 10 staff = KES 3,500 / month". */
export function planExampleLine(plan: PricingPlan): string | null {
  if (plan.rateKesPerEmployee === null || !plan.exampleEmployees) return null;
  const total = plan.exampleEmployees * plan.rateKesPerEmployee;
  return `e.g. ${plan.exampleEmployees} staff = ${formatMonthlyKes(total)}`;
}

export function freeParallelRunSmallPrint(): string {
  return `Available for teams of ${FREE_PARALLEL_RUN.minEmployees} or more.`;
}

export function internationalPricingBody(): string {
  return `Kenyan payroll and statutory compliance for foreign companies, billed in USD from $${INTERNATIONAL_PRICING.fromUsdPerEmployee} per employee per month.`;
}

export function contactHref(intent?: PricingIntent): string {
  return intent ? `/contact?intent=${intent}` : '/contact';
}

export function planCtaHref(plan: PricingPlan): string {
  return contactHref(plan.ctaIntent);
}

/** Enquiry types on /contact. `intent` links a pricing CTA to the right option. */
export const CONTACT_ENQUIRY_TYPES: readonly { value: string; intent?: PricingIntent }[] = [
  { value: 'General' },
  { value: 'Free payroll run', intent: PRICING_INTENTS.parallelRun },
  { value: 'Enterprise', intent: PRICING_INTENTS.enterprise },
  { value: 'International / USD billing', intent: PRICING_INTENTS.international },
];

export const DEFAULT_CONTACT_ENQUIRY_TYPE = CONTACT_ENQUIRY_TYPES[0]!.value;

/** Resolve `?intent=` to an enquiry type, falling back to General. */
export function contactEnquiryTypeForIntent(intent: string | undefined): string {
  const match = CONTACT_ENQUIRY_TYPES.find((option) => option.intent && option.intent === intent);
  return match?.value ?? DEFAULT_CONTACT_ENQUIRY_TYPE;
}

export const PRICING_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'What counts as an employee?',
    answer: BILLING_UNIT_DESCRIPTION,
  },
  {
    question: 'Is there a minimum team size?',
    answer:
      'No. You pay for the employees you have, and your bill grows only as your team does.',
  },
  {
    question: 'How does the free payroll run work?',
    answer: `We import your data and run one full cycle in parallel with your current payroll. You compare the outputs. If you go ahead, your subscription starts from the next cycle. ${freeParallelRunSmallPrint()}`,
  },
  {
    question: 'Can I change plans?',
    answer: 'Yes, at any time. Changes apply from the next billing month.',
  },
  {
    question: 'Do you charge setup or migration fees?',
    answer: `No, on ${pricingPlanName('essentials')} and ${pricingPlanName('growth')}. ${pricingPlanName('enterprise')} rollouts are scoped individually.`,
  },
];
