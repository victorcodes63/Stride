/**
 * High-intent SEO landing content for the marketing site.
 * Keep copy factual and aligned with product capabilities.
 */
import { MARKETING_ROUTES } from '@/lib/marketing-config';
import { formatKes, getPricingPlan } from '@/lib/pricing';

const essentialsRate = getPricingPlan('essentials').rateKesPerEmployee ?? 350;

export type SeoLandingId =
  | 'hris-kenya'
  | 'hrms-kenya'
  | 'payroll-software-kenya'
  | 'mpesa-payroll'
  | 'statutory-payroll-kenya';

export type SeoLandingDefinition = {
  id: SeoLandingId;
  path: `/${SeoLandingId}`;
  /** Title segment only — layout appends `| Stride`. */
  title: string;
  description: string;
  keywords: readonly string[];
  badge: string;
  /** H1 — second span can be coral via JSX in the page. */
  headlineLead: string;
  headlineAccent: string;
  intro: string;
  points: readonly { title: string; body: string }[];
  faq: readonly { question: string; answer: string }[];
  visual: 'people' | 'statutory' | 'payout' | 'overview';
  related: readonly { href: string; label: string }[];
};

export const SEO_LANDINGS: readonly SeoLandingDefinition[] = [
  {
    id: 'hris-kenya',
    path: '/hris-kenya',
    title: 'HRIS Kenya',
    description:
      'HRIS software for Kenyan businesses: employee records, leave, attendance and payroll with PAYE, NSSF, SHIF and Housing Levy built in. From KES 350 per employee.',
    keywords: [
      'HRIS Kenya',
      'HRIS software Kenya',
      'human resource information system Kenya',
      'HRIS Nairobi',
      'Kenya HRIS',
    ],
    badge: 'HRIS Kenya',
    headlineLead: 'HRIS built for',
    headlineAccent: 'Kenyan teams.',
    intro:
      'Stride is an HRIS for East Africa: one employee record for HR, leave, attendance and payroll, with Kenyan statutory rules on every payslip—not bolted on later.',
    points: [
      {
        title: 'One employee record',
        body: 'Profiles, contracts, leave and attendance feed payroll automatically, so HR and finance stop re-keying.',
      },
      {
        title: 'Kenya compliance in the run',
        body: 'PAYE, NSSF, SHIF and Housing Levy calculate on every payslip, with iTax-ready exports.',
      },
      {
        title: 'Self-service for staff',
        body: 'Employees request leave, see payslips and update details on mobile without email chains.',
      },
    ],
    faq: [
      {
        question: 'Is Stride an HRIS for Kenya?',
        answer:
          'Yes. Stride is an HRIS (human resource information system) with payroll and finance for Kenyan employers, including PAYE, NSSF, SHIF, Housing Levy and M-Pesa disbursements.',
      },
      {
        question: 'How is Stride different from a generic HRIS?',
        answer:
          'Kenyan statutory rules and M-Pesa payouts are built into payroll, not approximated in spreadsheets or a separate local add-on.',
      },
      {
        question: 'What does Stride HRIS cost?',
        answer: `Essentials starts at ${formatKes(essentialsRate)} per active employee per month. Your first payroll run is free.`,
      },
    ],
    visual: 'people',
    related: [
      { href: '/hrms-kenya', label: 'HRMS Kenya' },
      { href: '/payroll-software-kenya', label: 'Payroll software Kenya' },
      { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
    ],
  },
  {
    id: 'hrms-kenya',
    path: '/hrms-kenya',
    title: 'HRMS Kenya',
    description:
      'HRMS software in Kenya for workforce, leave, attendance and payroll. Run HR and payslips on one platform with M-Pesa and KRA-ready filings.',
    keywords: [
      'HRMS Kenya',
      'HRMS software Kenya',
      'human resource management system Kenya',
      'HRMS Nairobi',
      'Kenya HRMS',
    ],
    badge: 'HRMS Kenya',
    headlineLead: 'HRMS that runs',
    headlineAccent: 'payroll too.',
    intro:
      'Stride is an HRMS for Kenyan organisations that need people operations and payroll together—recruitment, leave, attendance, payslips and statutory filings on one login.',
    points: [
      {
        title: 'Workforce to payslip',
        body: 'Hire, onboard and manage staff in the same system that runs payroll each month.',
      },
      {
        title: 'Approvals that feed finance',
        body: 'Leave and attendance approvals land in the pay run, so finance is not chasing spreadsheets.',
      },
      {
        title: 'Grow into modules',
        body: 'Start with HR and payroll, then add finance, procurement or industry packs without changing systems.',
      },
    ],
    faq: [
      {
        question: 'What is an HRMS, and is Stride one?',
        answer:
          'An HRMS (human resource management system) covers workforce processes end to end. Stride is an HRMS with Kenyan payroll, statutory compliance and optional finance modules.',
      },
      {
        question: 'HRIS vs HRMS — which is Stride?',
        answer:
          'Both labels apply: Stride stores the employee record (HRIS) and runs day-to-day people and payroll processes (HRMS). We use the terms the way Kenyan buyers search for them.',
      },
      {
        question: 'Can we start with HRMS only?',
        answer:
          'Yes. Every plan includes HR & Payroll and Finance. You can lean on the HRMS features first and switch on more modules when you need them.',
      },
    ],
    visual: 'people',
    related: [
      { href: '/hris-kenya', label: 'HRIS Kenya' },
      { href: '/statutory-payroll-kenya', label: 'Statutory payroll Kenya' },
      { href: MARKETING_ROUTES.platform, label: 'Platform' },
    ],
  },
  {
    id: 'payroll-software-kenya',
    path: '/payroll-software-kenya',
    title: 'Payroll software Kenya',
    description:
      'Payroll software for Kenya with PAYE, NSSF, SHIF, Housing Levy and M-Pesa salary payouts. Free first payroll run. From KES 350 per employee.',
    keywords: [
      'payroll software Kenya',
      'Kenya payroll system',
      'online payroll Kenya',
      'payroll software Nairobi',
      'cloud payroll Kenya',
    ],
    badge: 'Payroll Kenya',
    headlineLead: 'Payroll software',
    headlineAccent: 'for Kenya.',
    intro:
      'Run Kenyan payroll without spreadsheet risk: statutory deductions on every payslip, iTax-ready exports, and bulk M-Pesa disbursement with reconciliation back to the run.',
    points: [
      {
        title: 'Statutory on every run',
        body: 'PAYE, NSSF, SHIF and Housing Levy calculate automatically for Kenya (and multi-entity when you need it).',
      },
      {
        title: 'M-Pesa and bank files',
        body: 'Pay salaries in bulk and reconcile payouts to the same payroll records finance already signed off.',
      },
      {
        title: 'Free parallel run',
        body: 'We run your first payroll free alongside your current process so you can check every figure.',
      },
    ],
    faq: [
      {
        question: 'Does Stride support Kenyan payroll statutes?',
        answer:
          'Yes. PAYE, NSSF, SHIF and Housing Levy are calculated on every payslip, with exports suited to KRA iTax filing.',
      },
      {
        question: 'Can we pay salaries via M-Pesa?',
        answer:
          'Yes. Bulk M-Pesa disbursement is built into payroll, with status and reconciliation tied to the pay run.',
      },
      {
        question: 'How much is payroll software from Stride?',
        answer: `From ${formatKes(essentialsRate)} per active employee per month on Essentials. No setup fees and no minimums.`,
      },
    ],
    visual: 'overview',
    related: [
      { href: '/hris-kenya', label: 'HRIS Kenya' },
      { href: '/mpesa-payroll', label: 'M-Pesa payroll' },
      { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
    ],
  },
  {
    id: 'mpesa-payroll',
    path: '/mpesa-payroll',
    title: 'M-Pesa payroll',
    description:
      'M-Pesa salary disbursement from Stride payroll: bulk payouts, reconciliation to the pay run, and Kenyan statutory deductions on the same cycle.',
    keywords: [
      'M-Pesa payroll',
      'M-Pesa salary payment',
      'bulk M-Pesa disbursement',
      'payroll M-Pesa Kenya',
      'pay salaries M-Pesa',
    ],
    badge: 'M-Pesa payroll',
    headlineLead: 'M-Pesa payroll',
    headlineAccent: 'from the pay run.',
    intro:
      'Approve payroll once, then send salaries over M-Pesa with reconciliation back to the same records—so cash movement and statutory filings stay aligned.',
    points: [
      {
        title: 'Bulk disbursement',
        body: 'Pay many employees in one go without exporting fragile bank sheets as the source of truth.',
      },
      {
        title: 'Reconciled to payroll',
        body: 'Payout status ties back to the approved run for audit and finance follow-up.',
      },
      {
        title: 'Same cycle as compliance',
        body: 'Statutory deductions and M-Pesa payouts sit on one payroll process, not two disconnected tools.',
      },
    ],
    faq: [
      {
        question: 'Does Stride support M-Pesa salary payments?',
        answer:
          'Yes. Stride supports bulk M-Pesa disbursement from the payroll module, with reconciliation to the pay run.',
      },
      {
        question: 'Do we still need a separate banking file?',
        answer:
          'You can still export bank files where needed. Many Kenyan teams use M-Pesa for most staff and keep bank payouts for exceptions.',
      },
      {
        question: 'Is M-Pesa payroll available on every plan?',
        answer: 'M-Pesa disbursement is included with Stride HR & Payroll on every plan.',
      },
    ],
    visual: 'payout',
    related: [
      { href: '/payroll-software-kenya', label: 'Payroll software Kenya' },
      { href: '/statutory-payroll-kenya', label: 'Statutory payroll' },
      { href: MARKETING_ROUTES.contact, label: 'Book a demo' },
    ],
  },
  {
    id: 'statutory-payroll-kenya',
    path: '/statutory-payroll-kenya',
    title: 'Statutory payroll Kenya',
    description:
      'Kenyan statutory payroll software: PAYE, NSSF, SHIF and Housing Levy on every payslip, with iTax-ready exports and audit trails.',
    keywords: [
      'statutory payroll Kenya',
      'PAYE software Kenya',
      'NSSF SHIF Housing Levy',
      'iTax payroll',
      'KRA payroll software',
    ],
    badge: 'Statutory Kenya',
    headlineLead: 'PAYE, NSSF, SHIF',
    headlineAccent: 'and Housing Levy.',
    intro:
      'Statutory rules are calculated on every Stride payslip—not approximated after the fact—so filings and employee figures stay consistent.',
    points: [
      {
        title: 'Four obligations, one run',
        body: 'PAYE, NSSF, SHIF and Housing Levy apply automatically with the period you are paying.',
      },
      {
        title: 'iTax-ready exports',
        body: 'Generate the schedules finance needs for KRA and related portals without rebuilding them in Excel.',
      },
      {
        title: 'Audit from approval to file',
        body: 'See who approved the run and what was remitted, so compliance reviews are faster.',
      },
    ],
    faq: [
      {
        question: 'Which Kenyan statutory deductions does Stride support?',
        answer: 'PAYE, NSSF, SHIF and Housing Levy are calculated on every payslip for Kenya payroll.',
      },
      {
        question: 'Can we export for iTax?',
        answer:
          'Yes. Stride produces statutory exports intended for KRA iTax filing workflows alongside your normal pay run.',
      },
      {
        question: 'Does this work for multi-entity groups?',
        answer:
          'Yes. Growth and Enterprise support multi-entity setups so each entity can file correctly while sharing one Stride login.',
      },
    ],
    visual: 'statutory',
    related: [
      { href: '/hris-kenya', label: 'HRIS Kenya' },
      { href: '/payroll-software-kenya', label: 'Payroll software Kenya' },
      { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
    ],
  },
] as const;

export function getSeoLanding(id: SeoLandingId): SeoLandingDefinition {
  const landing = SEO_LANDINGS.find((entry) => entry.id === id);
  if (!landing) throw new Error(`Unknown SEO landing: ${id}`);
  return landing;
}
