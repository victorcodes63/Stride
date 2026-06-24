/** Stride public marketing site — content and routing config. */

export const MARKETING_ROUTES = {
  home: '/',
  platform: '/platform',
  industries: '/industries',
  pricing: '/pricing',
  about: '/about',
  contact: '/contact',
  login: '/dashboard/login',
  /** Unlisted — linked from footer when demo access is enabled; no password on page. */
  demoAccess: '/demo-access',
} as const;

/** Public marketing site hostname (no protocol). */
export const MARKETING_CANONICAL_DOMAIN =
  process.env.NEXT_PUBLIC_MARKETING_DOMAIN?.trim() || 'getstride.co.ke';

/** Client app origin shown in product mockups (dashboard login lives here). */
export const MARKETING_APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim()?.replace(/\/$/, '') ||
  'https://app.getstride.co.ke';

/** Host + optional path for mockup chrome bars, e.g. app.getstride.co.ke/dashboard */
export function marketingAppHostLabel(path = ''): string {
  try {
    const host = new URL(MARKETING_APP_ORIGIN).host;
    return path ? `${host}${path.startsWith('/') ? path : `/${path}`}` : host;
  } catch {
    return `app.${MARKETING_CANONICAL_DOMAIN}${path}`;
  }
}

export function getMarketingSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return `https://${MARKETING_CANONICAL_DOMAIN}`;
}

function isLocalDevHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized.endsWith('.localhost')
  );
}

/** Staff login — same host when marketing + app share a deploy; app subdomain when split. */
export function getMarketingLoginUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return MARKETING_ROUTES.login;
  }

  try {
    const siteUrl = getMarketingSiteUrl();
    const siteHost = new URL(siteUrl).host;

    // Local dev runs marketing + dashboard on one Next server.
    if (isLocalDevHost(siteHost)) {
      return MARKETING_ROUTES.login;
    }

    const appHost = new URL(MARKETING_APP_ORIGIN).host;
    if (appHost !== siteHost) {
      return `${MARKETING_APP_ORIGIN.replace(/\/$/, '')}/dashboard/login`;
    }
  } catch {
    /* fall through */
  }
  return MARKETING_ROUTES.login;
}

/** Home URL for close buttons on login/contact — same host in dev; marketing domain when app is split. */
export function getMarketingHomeUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return MARKETING_ROUTES.home;
  }

  try {
    const siteUrl = getMarketingSiteUrl();
    const siteHost = new URL(siteUrl).host;

    if (isLocalDevHost(siteHost)) {
      return MARKETING_ROUTES.home;
    }

    const appHost = new URL(MARKETING_APP_ORIGIN).host;
    if (appHost !== siteHost) {
      return siteUrl;
    }
  } catch {
    /* fall through */
  }
  return MARKETING_ROUTES.home;
}

/**
 * Public sales inbox — footer, contact page mailto links, and book-demo CTAs.
 * TODO(launch): Confirm hello@getstride.co.ke is live and monitored before shipping.
 * Update MARKETING_SALES_EMAIL and any legacy hello@raventechgroup.com references together.
 */
export const MARKETING_SALES_EMAIL = 'hello@getstride.co.ke';

/**
 * TODO(launch): Replace with the confirmed Stride or Raven Tech Group LinkedIn company page URL.
 * Placeholder only — do not ship without verifying the page exists.
 */
export const MARKETING_LINKEDIN_URL = 'https://linkedin.com/company/raventechgroup';

/** Self-serve sandbox — footer + hero when demo access is enabled. */
export function getMarketingTryDemoUrl(): string {
  return MARKETING_ROUTES.demoAccess;
}

/** Sales-led CTAs — book demo is sales; trySandbox is self-serve when enabled. */
export const MARKETING_CTAS = {
  bookDemo: 'Book a demo',
  trySandbox: 'Try the sandbox',
  signIn: 'Sign in',
  talkToSales: 'Talk to sales',
  watchDemo: 'Watch demo',
  seeFleet: 'See the fleet module',
  joinWaitlist: 'Join the waitlist',
  explorePlatform: 'Explore the platform',
} as const;

export const MARKETING_NAV_LINKS = [
  { href: MARKETING_ROUTES.platform, label: 'Platform' },
  { href: MARKETING_ROUTES.industries, label: 'Industries' },
  { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
  { href: MARKETING_ROUTES.about, label: 'About' },
] as const;

export const MARKETING_HERO = {
  eyebrow: 'Business management platform · East Africa',
  titleLines: ['Run your whole', 'business as one.'] as const,
  /** Final phrase on the accent line, rendered in brand coral. */
  titleAccent: 'as one.',
  sub:
    'One platform for people, payroll, finance and operations — with East African compliance built in, not bolted on.',
  descriptionHighlight: 'East African compliance',
  trustBadge: 'Built for Kenya',
  trustTags: 'M-Pesa · KRA · NSSF',
} as const;

export const MARKETING_WHY_STRIDE = {
  badge: 'Why we built it',
  titleLines: ['Global ERPs were', 'never built for here.'] as const,
  paragraphs: [
    {
      lead:
        'Most global platforms were built for somewhere else, then adapted for Kenya — M-Pesa bolted on, statutory rules approximated, support queued in another timezone. Stride flips that: a horizontal core every business runs on, with vertical packs that add industry depth — ',
      emphasis: 'no separate system, no integration project.',
    },
    {
      lead:
        'We build and deploy Stride for SACCOs, fintechs, HR consultancies and logistics operators — organisations that have outgrown spreadsheets but can\u2019t justify an eighteen-month ERP rollout.',
    },
  ] as const,
} as const;

export const MARKETING_INDUSTRIES_SECTION = {
  badge: 'Built for your industry',
  title: 'Then it gets specific.',
} as const;

/** Brand tokens for studio-craft (v3) — mirrors public-theme.css, no new colors. */
export const MARKETING_BRAND = {
  coral: '#FF5436',
  coralDeep: '#E63E22',
  ink: '#1A1714',
  inkMuted: '#3D3833',
  paper: '#FBF8F4',
  paper2: '#F4EFE8',
  line: '#E6DED4',
} as const;

/** Product screenshot for homepage hero showcase — clipped to hero viewport. */
export const MARKETING_DASHBOARD_HERO = {
  src: '/images/dashboard_home.png',
  width: 2984,
  height: 1792,
  alt: 'Stride HR and payroll dashboard — people and workforce overview',
} as const;

/** Statutory compliance screenshot for “Why we built it”. */
export const MARKETING_STATUTORY_SCREENSHOT = {
  src: '/images/payroll_screenshot.png',
  width: 3230,
  height: 1944,
  alt: 'Stride statutory compliance — PAYE, NSSF, SHIF and Housing Levy in one Kenya payroll view',
} as const;

/** Platform overview — module command center on the live dashboard. */
export const MARKETING_PLATFORM_MODULES_SCREENSHOT = {
  src: '/images/platform_modules.png',
  width: 1024,
  height: 615,
  alt: 'Stride platform overview — Finance, HR & Payroll, Legal, Procurement, Admin and Projects on one login',
} as const;

/** Product screenshots for industry / architecture vertical previews. */
export const MARKETING_VERTICAL_SCREENSHOTS = {
  logistics: {
    src: '/marketing/stride-vertical-logistics.png',
    alt: 'Stride logistics trip board — fleet workflow kanban',
    moduleLabel: 'Fleet & logistics',
    screenTitle: 'Trip board',
    path: '/fleet/trips',
  },
  saccos: {
    src: '/marketing/stride-vertical-saccos.png',
    alt: 'Stride Heritage Members SACCO — statutory payroll and compliance',
    moduleLabel: 'Heritage Members SACCO',
    screenTitle: 'Statutory compliance',
    path: '/payroll/statutory',
  },
  healthcare: {
    src: '/marketing/stride-vertical-healthcare.png',
    alt: 'Stride rota grid — shift scheduling for clinical teams',
    moduleLabel: 'Healthcare',
    screenTitle: 'Rota grid',
    path: '/rota',
  },
  energy: {
    src: '/marketing/stride-vertical-energy.png',
    alt: 'Stride HSE incidents panel — safety and compliance tracking',
    moduleLabel: 'Energy',
    screenTitle: 'HSE panel',
    path: '/hse',
  },
  construction: {
    src: '/marketing/stride-vertical-construction.png',
    alt: 'Stride asset register — plant and site equipment tracking',
    moduleLabel: 'Construction',
    screenTitle: 'Site tracker',
    path: '/projects',
  },
} as const;

export type MarketingVerticalScreenshotId = keyof typeof MARKETING_VERTICAL_SCREENSHOTS;

export const MARKETING_DEMO_STEPS = [
  { number: 1, text: 'Tell us about your team' },
  { number: 2, text: 'Pick the modules you need' },
  { number: 3, text: 'Book your walkthrough' },
] as const;

/** Book-a-demo left panel — HLS stream with MP4 fallback. */
export const MARKETING_DEMO_VIDEO = {
  hls: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.m3u8',
  mp4: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4',
} as const;

/** Hero shader tuning — warm paper base with slow coral drift (matches live site). */
export const MARKETING_HERO_SHADER = {
  swirl: {
    colorA: MARKETING_BRAND.paper,
    colorB: MARKETING_BRAND.paper2,
    detail: 1.35,
    speed: 0.32,
    blend: 42,
    colorSpace: 'oklch' as const,
  },
  chromaFlow: {
    baseColor: MARKETING_BRAND.paper,
    upColor: MARKETING_BRAND.paper2,
    downColor: MARKETING_BRAND.coral,
    leftColor: MARKETING_BRAND.paper2,
    rightColor: MARKETING_BRAND.coral,
    intensity: 0.58,
    momentum: 26,
    radius: 2.6,
  },
  flutedGlass: {
    aberration: 0.38,
    angle: 31,
    frequency: 7,
    highlight: 0.08,
    highlightSoftness: 0.45,
    lightAngle: -90,
    refraction: 2.8,
    shape: 'rounded' as const,
    softness: 1,
    speed: 0.07,
  },
  filmGrain: { strength: 0.035 },
} as const;

/** @deprecated Placeholder names — do not use as social proof. Prefer INDUSTRY_VERTICALS for sector focus. */
export const TRUST_CLIENTS = [
  'Heritage Members SACCO',
  'SwiftFreight',
  'Northline Petroleum',
  'Cape Media',
  "St. Paul's",
] as const;

export type MarketingModuleReadiness = 'live' | 'partial' | 'roadmap';

export const MARKETING_READINESS_META: Record<
  MarketingModuleReadiness,
  { label: string; title: string; badgeClass: string }
> = {
  live: {
    label: 'Live',
    title: 'Generally available in production',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  partial: {
    label: 'Partial',
    title: 'Core workflows shipping — some features still on the roadmap',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  roadmap: {
    label: 'Roadmap',
    title: 'Planned — not yet available for production use',
    badgeClass: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  },
};

export const CORE_MODULES: {
  num: string;
  name: string;
  description: string;
  readiness: MarketingModuleReadiness;
}[] = [
  {
    num: '01 — HR',
    name: 'HR & Payroll',
    readiness: 'partial',
    description:
      'Payroll runs, leave, performance reviews and employee self-service — KRA, NSSF and SHIF compliance built in. Core HR paths are demo-ready; some enterprise edge cases still shipping.',
  },
  {
    num: '02 — Finance',
    name: 'Finance',
    readiness: 'partial',
    description:
      'Accounts, budgets, approvals and M-Pesa disbursements on one ledger. Invoicing and core GL are live; advanced statements and billing automation are still rolling out.',
  },
  {
    num: '03 — Procurement',
    name: 'Procurement',
    readiness: 'partial',
    description:
      'Purchase requests with approval workflow are live. LPO generation, GRN and three-way match into finance are on the roadmap.',
  },
  {
    num: '04 — Legal',
    name: 'Legal & Documents',
    readiness: 'partial',
    description:
      'Contract registers, credentials and document workflows. Core registers are usable; obligation alerts and unified legal hub are still maturing.',
  },
  {
    num: '05 — Projects',
    name: 'Projects',
    readiness: 'roadmap',
    description:
      'Deliverables, tasks and budget burn against your team — planned for a later phase. Placeholder pages exist; full project workspaces are not GA yet.',
  },
  {
    num: '06 — Admin',
    name: 'Admin',
    readiness: 'partial',
    description:
      'Asset registers, fleet, facilities and governance basics. Fleet and assets are partially live; facilities and board workflows are still on the roadmap.',
  },
];

/** Rich module detail for /platform — prospective-client depth beyond homepage cards. */
export const PLATFORM_MODULES: {
  num: string;
  name: string;
  headline: string;
  description: string;
  features: string[];
  readiness: MarketingModuleReadiness;
}[] = [
  {
    num: '01',
    name: 'HR & Payroll',
    readiness: 'partial',
    headline: 'Pay people correctly. Stay compliant.',
    description:
      'Included at sign-up — every business has people to pay. Kenyan statutory rules, payroll run wizard, leave hub, performance cycles and ESS are shipping on the core.',
    features: [
      'Payroll runs, payslips and P9 exports',
      'Leave, attendance and onboarding workflows',
      'Employee self-service (ESS) portal',
      'KRA PAYE, NSSF, SHIF and statutory deductions',
      'Recruitment & ATS when you need to hire',
    ],
  },
  {
    num: '02',
    name: 'Finance',
    readiness: 'partial',
    headline: 'One ledger for how money actually moves.',
    description:
      'Included at sign-up — accounts, budgets, approvals and collections on the same chart of accounts payroll posts to. Core GL and invoicing are live; advanced statements and billing automation are still rolling out.',
    features: [
      'General ledger, budgets and cost centres',
      'Approval chains for payments and journals',
      'M-Pesa bulk disbursements and reconciliation',
      'Invoicing, receipts and aged debtors',
      'Management reports tied to live payroll data',
    ],
  },
  {
    num: '03',
    name: 'Procurement',
    readiness: 'partial',
    headline: 'Structured spend from request to payment.',
    description:
      'Purchase requests and vendor records with approval workflows are live today. LPO generation, goods received notes and finance matching are on the roadmap.',
    features: [
      'Purchase requests and multi-level approvals',
      'Vendor register and rate cards',
      'LPO generation and goods received notes',
      'Spend tracking by department and project',
      'Three-way match into finance when goods are received',
    ],
  },
  {
    num: '04',
    name: 'Legal & Documents',
    readiness: 'partial',
    headline: 'Contracts and obligations you will not miss.',
    description:
      'Registers for contracts, licences and compliance documents — with renewal reminders on the roadmap. Core contract and credential registers are usable today.',
    features: [
      'Contract and licence registers',
      'Renewal alerts and obligation tracking',
      'Document templates and e-sign workflows',
      'Board resolutions and governance records',
      'Audit trail on sensitive document access',
    ],
  },
  {
    num: '05',
    name: 'Projects',
    readiness: 'roadmap',
    headline: 'Deliverables tied to real people and budgets.',
    description:
      'Project plans, task assignment and budget burn — planned for a later phase. Placeholder workspaces exist; full delivery tracking is not GA yet.',
    features: [
      'Project workspaces and milestone tracking',
      'Task assignment to team members',
      'Budget vs actual against finance ledger',
      'Time and deliverable reporting',
      'Client billing hooks into invoicing',
    ],
  },
  {
    num: '06',
    name: 'Admin',
    readiness: 'partial',
    headline: 'The operational layer most platforms skip.',
    description:
      'Assets, fleet registers, facilities and internal admin workflows. Fleet and asset basics are partially live; facilities and governance packs are still maturing.',
    features: [
      'Fixed asset and equipment registers',
      'Fleet and facility management basics',
      'Internal requests and service desk',
      'Policy acknowledgements and staff comms',
      'Foundation for vertical packs like logistics',
    ],
  },
];

export const PLATFORM_PAGE = {
  hero: {
    eyebrow: 'The platform',
    titleLines: ['Everything your business', 'runs on.'] as const,
    description:
      'Stride is a horizontal operations platform — not just HR software. Payroll is the wedge every business needs, but finance, procurement, documents, projects and admin share the same org chart, employee records and approval flows.',
    highlights: [
      'Six core modules on one login — each badged Live, Partial or Roadmap',
      'Kenyan payroll, M-Pesa disbursements and statutory filing on the core',
      'Enable modules as you grow — no forced bundles or shelfware',
    ],
  },
  audience: {
    badge: 'Who it is for',
    title: 'Built for teams that have outgrown spreadsheets.',
    body: 'If payroll lives in Excel, approvals happen on WhatsApp and finance reconciles at month-end, Stride replaces the patchwork — without an eighteen-month ERP rollout.',
  },
  connected: {
    badge: 'One data layer',
    title: 'Modules that actually talk to each other.',
    body: 'Employee records, org structure and approvals are shared — so a trip settlement, purchase order or payslip never needs to be re-keyed in another system.',
  },
  compliance: {
    badge: 'East Africa native',
    title: 'Compliance is not an add-on.',
    body: 'Statutory logic, disbursement rails and data protection are designed for how Kenyan businesses operate — not retrofitted from a global template.',
  },
} as const;

export const PLATFORM_AUDIENCE = [
  {
    title: '15–300 staff',
    body: 'Growing SMEs and mid-market operators who need structure without enterprise complexity or per-seat pricing that scales out of control.',
  },
  {
    title: 'Multi-department teams',
    body: 'HR, finance and operations leaders who need one source of truth — not three systems that never reconcile at month-end.',
  },
  {
    title: 'Regulated organisations',
    body: 'SACCOs, fintechs, logistics firms and consultancies with statutory obligations, audit trails and multi-entity structures.',
  },
] as const;

export const PLATFORM_WORKFLOWS = [
  {
    title: 'Hire to pay',
    flow: 'Recruit → onboard → payroll run → M-Pesa disbursement → ledger',
    body: 'New hires move from offer letter to first payslip on shared employee records — no duplicate profiles across HR and finance.',
  },
  {
    title: 'Request to pay',
    flow: 'Purchase request → approval → LPO → GRN → vendor payment',
    body: 'Procurement is on the roadmap — the intended flow is approvals feeding finance when goods are received, with a full audit trail from who asked to who paid.',
  },
  {
    title: 'Trip to invoice',
    flow: 'Order → dispatch → POD → settlement → customer invoice',
    body: 'With the Logistics vertical, completed trips flow into billing and collections on the same finance module as payroll.',
  },
] as const;

export const PLATFORM_COMPLIANCE = [
  {
    id: 'paye',
    label: 'KRA PAYE',
    detail: 'PAYE calculations, payslips, P9s and filing-ready exports',
    category: 'Statutory',
    tags: ['PAYE', 'P9', 'iTax'],
    featured: true,
  },
  {
    id: 'nssf',
    label: 'NSSF & SHIF',
    detail: 'Statutory deductions calculated and reported each pay run',
    category: 'Statutory',
    tags: ['NSSF', 'SHIF'],
  },
  {
    id: 'mpesa',
    label: 'M-Pesa',
    detail: 'Bulk salary disbursements with reconciliation against payroll',
    category: 'Disbursements',
    tags: ['Bulk pay', 'Reconcile'],
  },
  {
    id: 'multi-entity',
    label: 'Multi-entity',
    detail: 'Separate legal entities, currencies and configs in one account',
    category: 'Structure',
    tags: ['Entities', 'FX'],
  },
  {
    id: 'odpc',
    label: 'ODPC-ready',
    detail: 'Audit trails, access controls and data export on exit',
    category: 'Governance',
    tags: ['Audit', 'Export'],
  },
  {
    id: 'region',
    label: 'Kenya & Uganda',
    detail: 'Payroll and statutory configs for cross-border operators',
    category: 'Region',
    tags: ['Kenya', 'Uganda'],
  },
] as const;

/** Payroll → disbursement → filing strip for compliance sections. */
export const PLATFORM_COMPLIANCE_FLOW = [
  'Payroll run',
  'Statutory calc',
  'M-Pesa disburse',
  'Ledger post',
  'Filed',
] as const;

export const PLATFORM_FAQ = [
  {
    question: 'How is Stride different from other HR platforms?',
    answer:
      "Most HR platforms either focus narrowly on payroll or are foreign tools retrofitted for Kenya. Stride is built from the ground up for East Africa — M-Pesa, KRA, NSSF and SHIF aren't add-ons — and grows beyond HR into finance, procurement, projects and industry-specific modules like fleet management, all on one login.",
  },
  {
    question: 'What modules do we sign up with?',
    answer:
      'Every Stride account includes two sign-up modules: HR & Payroll and Finance (both Partial — core workflows are live and we label what is still shipping). Procurement and Projects are on the Roadmap. Admin and Legal are Partial. Add vertical packs like Logistics when your sector needs them — one login, one data layer throughout.',
  },
  {
    question: 'Which modules are included in each pricing tier?',
    answer:
      'Starter includes the two sign-up modules (HR & Payroll and Finance) for up to 25 staff. Growth adds more modules and headcount. Enterprise is the full platform with bespoke rollout for regulated and multi-entity organisations. See pricing for current bands in Kenyan shillings.',
  },
  {
    question: 'Do you support M-Pesa for salary disbursements?',
    answer:
      'M-Pesa bulk disbursements and reconciliation are first-class — designed for how Kenyan businesses actually pay people, with matching back to payroll runs.',
  },
  {
    question: 'Do you support multi-entity or cross-border operations?',
    answer:
      'Yes. Stride supports multi-entity structures out of the box — separate legal entities, currencies and statutory configurations (including Kenya and Uganda) from a single account, with consolidated and entity-level reporting.',
  },
  {
    question: 'What industry verticals are available today?',
    answer:
      'Logistics & Cargo is live now — fleet, trips, POD and settlement on the core. SACCOs, Healthcare, Energy and Construction are on the roadmap; join the waitlist for your sector while using the horizontal core today.',
  },
] as const;

export type IndustrySector =
  | 'logistics'
  | 'saccos'
  | 'healthcare'
  | 'energy'
  | 'construction';

export const INDUSTRY_VERTICALS: {
  id: IndustrySector;
  name: string;
  status: 'available' | 'coming_soon';
  description: string;
  features: string[];
  href: string;
}[] = [
  {
    id: 'logistics',
    name: 'Logistics & Cargo',
    status: 'available',
    description:
      'Order intake, route & trip planning, vehicle and driver allocation, pre-trip compliance, in-transit monitoring, proof of delivery, settlement and billing — the full fleet workflow on one platform.',
    features: [
      'Fleet & vehicle register',
      'Route & trip planning',
      'Driver records & compliance',
      'Fuel & maintenance logs',
      'Delivery tracking & POD',
    ],
    href: '/industries/logistics',
  },
  {
    id: 'saccos',
    name: 'SACCOs',
    status: 'available',
    description:
      'Member-trusted payroll, workforce operations and board-ready reporting — our beachhead vertical with a live demo pack.',
    features: ['Member management', 'Dividends', 'BOSA / FOSA', 'Regulatory reporting'],
    href: '/industries/saccos',
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    status: 'coming_soon',
    description: 'Rota, biometric clock-in, and shift scheduling for clinical and non-clinical teams.',
    features: ['Shift rota', 'Biometric clock-in', 'Licence tracking', 'NHIF-ready payroll'],
    href: '/industries/healthcare',
  },
  {
    id: 'energy',
    name: 'Oil & Gas / Energy',
    status: 'coming_soon',
    description: 'HSE and compliance, incident reporting, and multi-entity operations for energy operators.',
    features: ['HSE & compliance', 'Incident reporting', 'Multi-entity', 'Permit tracking'],
    href: '/industries/energy',
  },
  {
    id: 'construction',
    name: 'Construction',
    status: 'coming_soon',
    description: 'Site and project management, plant tracking, and subcontractor workflows.',
    features: ['Site management', 'Asset / plant tracking', 'Subcontractors', 'Project budgets'],
    href: '/industries/construction',
  },
];

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'KES 18K',
    unit: 'per month · up to 25 staff',
    description: 'For small teams and consultancies getting their operations onto one platform.',
    features: [
      'HR & Payroll and Finance (sign-up modules)',
      'Up to 25 employees',
      'M-Pesa disbursements',
      'KRA / NSSF / SHIF compliance',
      'Email support',
    ],
    cta: 'Book a demo',
    featured: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'KES 55K',
    unit: 'per month · up to 100 staff',
    description: 'For growing organisations running multiple functions across one or more entities.',
    features: [
      '4 core modules included',
      'Up to 100 employees',
      'Multi-entity support',
      'Advanced approvals & workflows',
      'Priority support + onboarding',
    ],
    cta: 'Book a demo',
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    unit: '100+ staff · multi-entity',
    description: 'For SACCOs and regulated mid-market needing the full platform and bespoke rollout.',
    features: [
      'All six modules',
      'Unlimited employees',
      'Dedicated success manager',
      'Custom integrations & SLAs',
      'On-site implementation',
    ],
    cta: 'Talk to sales',
    featured: false,
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: 'Is Stride compliant with Kenyan payroll regulations?',
    answer:
      'Yes. KRA PAYE, NSSF, SHIF and statutory deductions are built in from day one — not bolted on as an afterthought. Payslips, P9s and filing exports are included.',
  },
  {
    question: 'How is Stride different from other HR platforms?',
    answer:
      "Most HR platforms either focus narrowly on payroll or are foreign tools retrofitted for Kenya. Stride is built from the ground up for East Africa — M-Pesa, KRA, NSSF and SHIF aren't add-ons — and grows beyond HR into finance, procurement, projects and industry-specific modules like fleet management, all on one login. Pricing is banded by organisation size, not per seat, so it fits a 12-person consultancy and a 300-staff SACCO alike.",
  },
  {
    question: 'What modules do we sign up with?',
    answer:
      'Every Stride account includes two sign-up modules: HR & Payroll and Finance (both Partial — core workflows are live and we label what is still shipping). Procurement and Projects are on the Roadmap. Admin and Legal are Partial. Add vertical packs like Logistics when your sector needs them — one login, one data layer throughout.',
  },
  {
    question: 'Do you support M-Pesa for salary disbursements?',
    answer:
      'M-Pesa bulk disbursements and reconciliation are first-class — designed for how Kenyan businesses actually pay people.',
  },
  {
    question: 'How long does onboarding take?',
    answer:
      'Most teams go live in days, not months. Guided onboarding, data import templates and local support are included on Growth and Enterprise plans.',
  },
  {
    question: 'Where is our data stored? Is it secure?',
    answer:
      'Data is hosted on modern cloud infrastructure with encryption in transit and at rest. We follow Kenya Data Protection Act (ODPC) principles and provide audit trails for sensitive actions.',
  },
  {
    question: 'What happens to our data if we leave?',
    answer:
      'Your data is yours. If you ever decide to leave, we provide a full export of your records — employees, payroll history, financial data — in standard formats, with no lock-in penalty or hidden fees.',
  },
  {
    question: 'Do you support multi-entity or cross-border operations?',
    answer:
      'Yes. Stride supports multi-entity structures out of the box — manage separate legal entities, currencies and statutory configurations (including Kenya and Uganda) from a single account, with consolidated and entity-level reporting.',
  },
  {
    question: 'Do you support my industry?',
    answer:
      'The horizontal core works for any business. Logistics & Cargo is available today as the first vertical pack; SACCOs, Healthcare, Energy and Construction are on the roadmap — join the waitlist for your sector.',
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 'Step 01',
    title: 'Start with what you need',
    body: 'Sign up with HR & Payroll and Finance — your two included modules. Add Procurement, Projects, Admin or vertical packs when you need them. No forced bundles, no shelfware.',
  },
  {
    step: 'Step 02',
    title: 'Configure for your context',
    body: 'Multi-entity, multi-currency, Kenya and Uganda compliance built in. Your structure, your accounts, your workflows.',
  },
  {
    step: 'Step 03',
    title: 'Live in days',
    body: 'Guided onboarding, data import and local support from a team that knows your market — not a queue in another timezone.',
  },
] as const;

/** Raven Tech Group — parent company link used across marketing surfaces. */
export const RAVEN_TECH_URL = 'https://raventechgroup.com';

/** /about — origin story (distinct from homepage MARKETING_WHY_STRIDE product pitch). */
export const ABOUT_ORIGIN = {
  badge: 'Our story',
  heading: 'We started inside the problem.',
  lead: "Stride didn't start as a software idea. It started as our own tooling.",
  paragraphs: [
    {
      text:
        'Raven Tech Group builds software for East African businesses. Along the way we kept seeing the same gap in HR, payroll and operations: global platforms that approximated KRA rules, billed in dollars per seat and queued support in another timezone — or spreadsheets and disconnected tools holding the rest together.',
    },
    {
      text: 'So we built the system we wished existed, and ',
      emphasis: 'put it in production with founding clients first',
      textAfter:
        '. Stride is what that became: a horizontal core for how East African businesses actually operate, with vertical packs for the sectors we know.',
    },
  ],
} as const;

/** /about — trust and data-handling signals (facts aligned with FAQ_ITEMS). */
export const ABOUT_TRUST = {
  badge: 'Trust & data',
  heading: 'Your data, handled properly.',
  items: [
    {
      id: 'odpc',
      title: 'ODPC-registered',
      body: "Registered data processor under Kenya's Data Protection Act.",
      icon: 'shield-check' as const,
    },
    {
      id: 'encryption',
      title: 'Encrypted & hosted responsibly',
      body: 'Encryption in transit and at rest, on modern cloud infrastructure.',
      icon: 'lock' as const,
    },
    {
      id: 'export',
      title: 'You own your data',
      body: 'Full export of employees, payroll and financial records on exit — no lock-in.',
      icon: 'download' as const,
    },
    {
      id: 'audit',
      title: 'Audit trails built in',
      body: 'Sensitive actions are logged and reviewable.',
      icon: 'list-checks' as const,
    },
  ],
} as const;

/** /about — company story, principles and proof. */
export const ABOUT_PAGE = {
  hero: {
    eyebrow: 'About Stride',
    titleLines: ['Built in East Africa,', 'for East Africa.'] as const,
    titleAccent: 'for East Africa.',
    description:
      'Stride is the operations platform from Raven Tech Group — payroll, finance and sector workflows on one login, in Kenyan shillings, with compliance from day one.',
    highlights: [
      'Horizontal core with vertical packs — not separate systems to integrate',
      'Built for Kenyan statutory, M-Pesa and multi-entity reality',
      'Honest roadmap — we ship what works and label what is coming soon',
    ],
  },
  principles: {
    badge: 'How we work',
    title: 'Three principles we do not compromise on.',
  },
  stats: [
    { value: '6', label: 'Core modules on one login' },
    { value: '100%', label: 'Kenyan statutory coverage — KRA, NSSF, SHIF' },
    { value: 'Days', label: 'To go live, not months' },
    { value: '2', label: 'Countries supported — Kenya & Uganda' },
  ] as const,
  closing: {
    title: 'See Stride in action',
    description: 'Book a walkthrough of the core modules and the logistics vertical.',
  },
} as const;

/** Shared with the old About page; now surfaced as v3 principle cards. */
export const ABOUT_PRINCIPLES = [
  {
    title: 'Built here, not ported',
    body: 'M-Pesa disbursements, KRA compliance, NSSF and SHIF logic, and multi-entity structures are first-class — not retrofitted from a global template.',
  },
  {
    title: 'Horizontal first, vertical when it matters',
    body: 'Every business runs on the same core: HR, finance, procurement, documents, projects and admin. Industry packs add the specialised 20% on top.',
  },
  {
    title: 'Honest about the roadmap',
    body: 'We ship what works. Verticals marked coming soon are on the roadmap — we do not pretend features exist when they do not.',
  },
] as const;

