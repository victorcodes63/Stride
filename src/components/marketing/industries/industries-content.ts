import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';

export type IndustryStatus = 'available' | 'coming_soon';

export type IndustryDeepDive = {
  id: string;
  name: string;
  status: IndustryStatus;
  positioning: string;
  pain: string;
  strideRuns: string;
  opportunity: string;
  href: string;
  ctaLabel: string;
  mediaKey: 'logistics' | 'hr_consultancy' | 'saccos' | 'healthcare' | 'energy' | 'construction';
};

/** Hero copy */
export const INDUSTRIES_HERO = {
  eyebrow: 'Industries',
  title: 'Built for your industry.',
  subhead:
    'Industry packs for HR consultancies, logistics, SACCOs, healthcare, energy and construction. Each one adds your sector’s workflows on the same HR, payroll and finance records.',
} as const;

/** Shared core platform capabilities */
export const CORE_CAPABILITIES = [
  'HR & people',
  'Payroll & statutory',
  'Finance & invoicing / eTIMS',
  'Employee self-service',
  'Reporting & analytics',
] as const;

export const CORE_PACKS_EXPLAINER = {
  title: 'One core. Vertical packs on top.',
  caption:
    'One system, one login, no integration project, verticals are packs layered on the shared platform, not separate products.',
  coreLabel: 'Stride Core',
} as const;

export const VERTICAL_PACKS = [
  { id: 'hr_consultancy', label: 'HR Consultancy', color: '#FF5436' },
  { id: 'logistics', label: 'Logistics & Cargo', color: '#E63E22' },
  { id: 'saccos', label: 'SACCOs', color: '#FF7A5C' },
  { id: 'healthcare', label: 'Healthcare', color: '#C9341B' },
  { id: 'energy', label: 'Oil & Gas / Energy', color: '#FF8A6E' },
  { id: 'construction', label: 'Construction', color: '#E63E22' },
] as const;

export const INDUSTRY_DEEP_DIVES: IndustryDeepDive[] = [
  {
    id: 'hr-consultancy',
    name: 'HR Consultancy',
    status: 'available',
    positioning: 'Recruitment, assessments, and client workforce ops, one login.',
    pain:
      'Boutique HR firms juggle separate ATS tools, spreadsheet shortlists, and payroll for each client, assessments live outside the pipeline and client billing is manual.',
    strideRuns:
      'Careers site and job posts → applicant pipeline → built-in AssessIQ candidate assessments (skills & aptitude, auto-scored) → interviews → hire → payroll and finance for client workforces on the same platform.',
    opportunity:
      'Thousands of East African HR consultancies outgrow spreadsheets but cannot afford enterprise talent suites. Stride bundles ATS, assessments, and Kenya-compliant payroll at SaaS pricing.',
    href: MARKETING_ROUTES.contact,
    ctaLabel: MARKETING_CTAS.bookDemo,
    mediaKey: 'hr_consultancy',
  },
  {
    id: 'logistics',
    name: 'Logistics & Cargo',
    status: 'available',
    positioning: 'The full fleet workflow on one platform.',
    pain:
      'Mid-size fleets run on WhatsApp, spreadsheets and disconnected tools, no single view of a trip, disputed settlements, billing done by hand.',
    strideRuns:
      'Order intake → route & trip planning → vehicle & driver allocation → pre-trip compliance → in-transit monitoring → proof of delivery → settlement & billing.',
    opportunity:
      'East African logistics is fragmented; mid-size operators can\'t justify enterprise TMS. Stride gives them one at SaaS pricing.',
    href: '/industries/logistics',
    ctaLabel: 'See the demo',
    mediaKey: 'logistics',
  },
  {
    id: 'saccos',
    name: 'SACCOs',
    status: 'available',
    positioning: 'Built for regulated cooperatives.',
    pain:
      'Legacy core systems are rigid and costly; member servicing and statutory reporting are manual.',
    strideRuns:
      'Member management, dividends, BOSA/FOSA operations, regulatory (SASRA-aligned) reporting.',
    opportunity:
      'Thousands of regulated SACCOs need modern, affordable digital operations, an underserved, compliance-heavy market.',
    href: '/industries/saccos',
    ctaLabel: 'See the demo',
    mediaKey: 'saccos',
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    status: 'available',
    positioning: 'Workforce operations for clinical and non-clinical teams.',
    pain:
      'Rota and shift scheduling live in spreadsheets; clock-in and compliance are hard to verify.',
    strideRuns: 'Rota & shift scheduling, biometric clock-in, attendance, compliance.',
    opportunity:
      'Growing private facilities need affordable, reliable workforce ops without enterprise HRIS cost.',
    href: '/industries/healthcare',
    ctaLabel: 'See the demo',
    mediaKey: 'healthcare',
  },
  {
    id: 'energy',
    name: 'Oil & Gas / Energy',
    status: 'available',
    positioning: 'Multi-entity operations and HSE, compliant by default.',
    pain:
      'Multi-entity, multi-country statutory complexity; HSE and incidents tracked on paper.',
    strideRuns:
      'HSE & compliance, incident reporting, multi-entity / multi-country operations and statutory.',
    opportunity:
      'Downstream operators run hundreds of staff across entities and borders with no unified system.',
    href: '/industries/energy',
    ctaLabel: 'See the demo',
    mediaKey: 'energy',
  },
  {
    id: 'construction',
    name: 'Construction',
    status: 'available',
    positioning: 'Sites, plant and subcontractors in one view.',
    pain:
      'Plant utilization is invisible; subcontractor and site-labor payments are manual and disputed.',
    strideRuns: 'Site & project management, plant tracking, subcontractor workflows.',
    opportunity:
      'Project-based firms lack affordable tools to control plant, labor and subcontractor spend.',
    href: '/industries/construction',
    ctaLabel: 'See the demo',
    mediaKey: 'construction',
  },
];

export const CORE_CAPABILITIES_BAND = {
  eyebrow: 'Shared foundation',
  title: 'Every vertical inherits the core.',
  description:
    'People, payroll, finance, self-service and analytics, live on day one, regardless of which pack you add.',
} as const;

export const STRIDE_VS_ALTERNATIVE = {
  title: 'Stride vs. the alternative',
  alternative: {
    heading: 'The old way',
    items: [
      'Separate systems per function',
      'Integration projects that never end',
      'Spreadsheets and WhatsApp for the gaps',
      'Duplicate data entry across tools',
    ],
  },
  stride: {
    heading: 'With Stride',
    items: [
      'One platform, one login',
      'Vertical packs, not separate products',
      'Core + sector workflows unified',
      'East African compliance built in',
    ],
  },
} as const;

export const INDUSTRIES_CLOSING_CTA = {
  title: 'See Stride for your sector.',
  description: 'Book a walkthrough of the core and the vertical packs relevant to your operation.',
  primary: { href: MARKETING_ROUTES.contact, label: MARKETING_CTAS.bookDemo },
  secondary: { href: MARKETING_ROUTES.contact, label: MARKETING_CTAS.talkToSales },
} as const;
