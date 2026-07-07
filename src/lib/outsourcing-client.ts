/** End-client (BPO) register — shared types and parsers for OUT-02. */

export const OUTSOURCING_CLIENT_STATUSES = ['active', 'suspended', 'churned'] as const;
export type OutsourcingClientStatus = (typeof OUTSOURCING_CLIENT_STATUSES)[number];

export const OUTSOURCING_REPORT_SECTIONS = [
  'workforce',
  'attendance',
  'leave',
  'payroll',
  'billing',
  'statutory',
] as const;
export type OutsourcingReportSection = (typeof OUTSOURCING_REPORT_SECTIONS)[number];

export const OUTSOURCING_RATE_SERVICES = [
  'per_head',
  'payroll_run',
  'attendance',
  'leave',
  'disciplinary',
  'recruitment',
  'fixed_monthly',
] as const;
export type OutsourcingRateService = (typeof OUTSOURCING_RATE_SERVICES)[number];

export const OUTSOURCING_PRICING_MODELS = ['per_head', 'flat', 'percentage'] as const;
export type OutsourcingPricingModel = (typeof OUTSOURCING_PRICING_MODELS)[number];

export const DEFAULT_OUTSOURCING_REPORT_SECTIONS: OutsourcingReportSection[] = [
  'workforce',
  'attendance',
  'leave',
  'payroll',
];

export type OutsourcingClientJson = {
  id: string;
  name: string;
  status: OutsourcingClientStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kraPin: string | null;
  nssfEmployerNumber: string | null;
  nhifEmployerNumber: string | null;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwiftCode: string | null;
  currency: string;
  billingCycle: string | null;
  serviceFeeType: string | null;
  serviceFeeAmount: string | null;
  paymentTerms: string | null;
  postalAddress: string | null;
  county: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractNotes: string | null;
  employeeNumberPrefix: string | null;
  payrollFrequency: string;
  leavePayMode: string;
  entityCode: string | null;
  clientLogoUrl: string | null;
  reportAccentColor: string | null;
  whiteLabelReports: boolean;
  reportRecipientEmails: string[];
  reportSections: OutsourcingReportSection[];
  employeeCount: number;
  departmentCount: number;
  activeRateCard: OutsourcingRateCardJson | null;
};

export type OutsourcingRateCardLineJson = {
  id: string;
  serviceKey: OutsourcingRateService;
  label: string;
  pricingModel: OutsourcingPricingModel;
  unitAmount: string;
  percentageBps: number | null;
  sortOrder: number;
};

export type OutsourcingRateCardJson = {
  id: string;
  name: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  lines: OutsourcingRateCardLineJson[];
};

function str(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  return typeof v === 'string' ? v.trim() || null : null;
}

function num(b: Record<string, unknown>, key: string): number | null {
  const v = b[key];
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

function bool(b: Record<string, unknown>, key: string): boolean | undefined {
  const v = b[key];
  if (typeof v === 'boolean') return v;
  return undefined;
}

function date(b: Record<string, unknown>, key: string): Date | undefined {
  const v = str(b, key);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseOutsourcingClientStatus(value: unknown): OutsourcingClientStatus {
  if (typeof value === 'string' && OUTSOURCING_CLIENT_STATUSES.includes(value as OutsourcingClientStatus)) {
    return value as OutsourcingClientStatus;
  }
  return 'active';
}

export function parseReportSections(value: unknown): OutsourcingReportSection[] {
  if (!Array.isArray(value)) return [...DEFAULT_OUTSOURCING_REPORT_SECTIONS];
  const allowed = new Set<string>(OUTSOURCING_REPORT_SECTIONS);
  const sections = value.filter((v): v is OutsourcingReportSection => typeof v === 'string' && allowed.has(v));
  return sections.length > 0 ? sections : [...DEFAULT_OUTSOURCING_REPORT_SECTIONS];
}

export function parseReportRecipientEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))];
}

export function parseClientBody(b: Record<string, unknown>) {
  const name = str(b, 'name') ?? '';
  const serviceFeeAmount = num(b, 'serviceFeeAmount');
  const status = b.status !== undefined ? parseOutsourcingClientStatus(b.status) : undefined;
  const whiteLabelReports = bool(b, 'whiteLabelReports');
  const reportRecipientEmails =
    b.reportRecipientEmails !== undefined ? parseReportRecipientEmails(b.reportRecipientEmails) : undefined;
  const reportSections = b.reportSections !== undefined ? parseReportSections(b.reportSections) : undefined;

  return {
    name,
    status,
    contactName: str(b, 'contactName') ?? undefined,
    contactEmail: str(b, 'contactEmail') ?? undefined,
    contactPhone: str(b, 'contactPhone') ?? undefined,
    kraPin: str(b, 'kraPin') ?? undefined,
    nssfEmployerNumber: str(b, 'nssfEmployerNumber') ?? undefined,
    nhifEmployerNumber: str(b, 'nhifEmployerNumber') ?? undefined,
    companyRegistrationNumber: str(b, 'companyRegistrationNumber') ?? undefined,
    vatNumber: str(b, 'vatNumber') ?? undefined,
    bankName: str(b, 'bankName') ?? undefined,
    bankAccountNumber: str(b, 'bankAccountNumber') ?? undefined,
    bankBranch: str(b, 'bankBranch') ?? undefined,
    bankSwiftCode: str(b, 'bankSwiftCode') ?? undefined,
    currency: str(b, 'currency') ?? undefined,
    billingCycle: str(b, 'billingCycle') ?? undefined,
    serviceFeeType: str(b, 'serviceFeeType') ?? undefined,
    serviceFeeAmount: serviceFeeAmount != null ? serviceFeeAmount : undefined,
    paymentTerms: str(b, 'paymentTerms') ?? undefined,
    postalAddress: str(b, 'postalAddress') ?? undefined,
    county: str(b, 'county') ?? undefined,
    contractStartDate: date(b, 'contractStartDate'),
    contractEndDate: date(b, 'contractEndDate'),
    contractNotes: str(b, 'contractNotes') ?? undefined,
    employeeNumberPrefix: str(b, 'employeeNumberPrefix') ?? undefined,
    payrollFrequency: str(b, 'payrollFrequency') ?? undefined,
    leavePayMode: str(b, 'leavePayMode') ?? undefined,
    clientLogoUrl: str(b, 'clientLogoUrl') ?? undefined,
    reportAccentColor: str(b, 'reportAccentColor') ?? undefined,
    whiteLabelReports,
    reportRecipientEmails,
    reportSections,
  };
}

export function parseRateService(value: unknown): OutsourcingRateService | null {
  if (typeof value === 'string' && OUTSOURCING_RATE_SERVICES.includes(value as OutsourcingRateService)) {
    return value as OutsourcingRateService;
  }
  return null;
}

export function parsePricingModel(value: unknown): OutsourcingPricingModel | null {
  if (typeof value === 'string' && OUTSOURCING_PRICING_MODELS.includes(value as OutsourcingPricingModel)) {
    return value as OutsourcingPricingModel;
  }
  return null;
}

export type RateCardLineInput = {
  serviceKey: OutsourcingRateService;
  label: string;
  pricingModel: OutsourcingPricingModel;
  unitAmount: number;
  percentageBps?: number | null;
  sortOrder?: number;
};

export function parseRateCardLines(value: unknown): RateCardLineInput[] {
  if (!Array.isArray(value)) return [];
  const lines: RateCardLineInput[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const row = raw as Record<string, unknown>;
    const serviceKey = parseRateService(row.serviceKey);
    const pricingModel = parsePricingModel(row.pricingModel);
    const label = str(row, 'label');
    const unitAmount = num(row, 'unitAmount');
    if (!serviceKey || !pricingModel || !label || unitAmount == null) return;
    lines.push({
      serviceKey,
      label,
      pricingModel,
      unitAmount,
      percentageBps: num(row, 'percentageBps'),
      sortOrder: num(row, 'sortOrder') ?? index,
    });
  });
  return lines;
}

type ClientRow = {
  id: string;
  name: string;
  status?: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kraPin: string | null;
  nssfEmployerNumber: string | null;
  nhifEmployerNumber: string | null;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwiftCode: string | null;
  currency: string | null;
  billingCycle: string | null;
  serviceFeeType: string | null;
  serviceFeeAmount: unknown;
  paymentTerms: string | null;
  postalAddress: string | null;
  county: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  contractNotes?: string | null;
  employeeNumberPrefix?: string | null;
  payrollFrequency?: string | null;
  leavePayMode?: string | null;
  entityCode?: string | null;
  clientLogoUrl?: string | null;
  reportAccentColor?: string | null;
  whiteLabelReports?: boolean | null;
  reportRecipientEmails?: unknown;
  reportSections?: unknown;
  _count: { employees: number; departments: number };
  rateCards?: Array<{
    id: string;
    name: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    currency: string;
    notes: string | null;
    isActive: boolean;
    lines: Array<{
      id: string;
      serviceKey: string;
      label: string;
      pricingModel: string;
      unitAmount: unknown;
      percentageBps: number | null;
      sortOrder: number;
    }>;
  }>;
};

function mapRateCardLine(line: {
  id: string;
  serviceKey: string;
  label: string;
  pricingModel: string;
  unitAmount: unknown;
  percentageBps: number | null;
  sortOrder: number;
}): OutsourcingRateCardLineJson {
  return {
    id: line.id,
    serviceKey: parseRateService(line.serviceKey) ?? 'per_head',
    label: line.label,
    pricingModel: parsePricingModel(line.pricingModel) ?? 'flat',
    unitAmount: line.unitAmount != null ? String(line.unitAmount) : '0',
    percentageBps: line.percentageBps,
    sortOrder: line.sortOrder,
  };
}

function mapRateCard(card: NonNullable<ClientRow['rateCards']>[number]): OutsourcingRateCardJson {
  return {
    id: card.id,
    name: card.name,
    effectiveFrom: card.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: card.effectiveTo?.toISOString().slice(0, 10) ?? null,
    currency: card.currency,
    notes: card.notes,
    isActive: card.isActive,
    lines: card.lines.map((line) => mapRateCardLine(line)),
  };
}

export function mapOutsourcingClientToJson(c: ClientRow): OutsourcingClientJson {
  const activeRateCard =
    c.rateCards?.find((card) => card.isActive) ?? c.rateCards?.[0] ?? null;

  return {
    id: c.id,
    name: c.name,
    status: parseOutsourcingClientStatus(c.status),
    contactName: c.contactName ?? null,
    contactEmail: c.contactEmail ?? null,
    contactPhone: c.contactPhone ?? null,
    kraPin: c.kraPin ?? null,
    nssfEmployerNumber: c.nssfEmployerNumber ?? null,
    nhifEmployerNumber: c.nhifEmployerNumber ?? null,
    companyRegistrationNumber: c.companyRegistrationNumber ?? null,
    vatNumber: c.vatNumber ?? null,
    bankName: c.bankName ?? null,
    bankAccountNumber: c.bankAccountNumber ?? null,
    bankBranch: c.bankBranch ?? null,
    bankSwiftCode: c.bankSwiftCode ?? null,
    currency: c.currency ?? 'KES',
    billingCycle: c.billingCycle ?? null,
    serviceFeeType: c.serviceFeeType ?? null,
    serviceFeeAmount: c.serviceFeeAmount != null ? String(c.serviceFeeAmount) : null,
    paymentTerms: c.paymentTerms ?? null,
    postalAddress: c.postalAddress ?? null,
    county: c.county ?? null,
    contractStartDate: c.contractStartDate?.toISOString().slice(0, 10) ?? null,
    contractEndDate: c.contractEndDate?.toISOString().slice(0, 10) ?? null,
    contractNotes: c.contractNotes ?? null,
    employeeNumberPrefix: c.employeeNumberPrefix ?? null,
    payrollFrequency: c.payrollFrequency ?? 'monthly',
    leavePayMode: c.leavePayMode ?? 'none',
    entityCode: c.entityCode ?? null,
    clientLogoUrl: c.clientLogoUrl ?? null,
    reportAccentColor: c.reportAccentColor ?? null,
    whiteLabelReports: c.whiteLabelReports === true,
    reportRecipientEmails: parseReportRecipientEmails(c.reportRecipientEmails),
    reportSections: parseReportSections(c.reportSections),
    employeeCount: c._count.employees,
    departmentCount: c._count.departments,
    activeRateCard: activeRateCard ? mapRateCard(activeRateCard) : null,
  };
}

/** Bill a single rate-card line (headcount × rate, flat, or % of payroll gross). */
export function computeRateCardLineAmount(
  line: Pick<OutsourcingRateCardLineJson, 'pricingModel' | 'unitAmount' | 'percentageBps'>,
  ctx: { headcount: number; payrollGrossTotal?: number },
): number {
  const headcount = Math.max(0, ctx.headcount);
  const gross = Math.max(0, ctx.payrollGrossTotal ?? 0);
  const unit = parseFloat(line.unitAmount) || 0;

  switch (line.pricingModel) {
    case 'per_head':
      return roundMoney(unit * headcount);
    case 'flat':
      return roundMoney(unit);
    case 'percentage': {
      const bps = line.percentageBps ?? Math.round(unit * 100);
      return roundMoney((gross * bps) / 10_000);
    }
    default:
      return 0;
  }
}

export function computeRateCardBillTotal(
  lines: Array<Pick<OutsourcingRateCardLineJson, 'pricingModel' | 'unitAmount' | 'percentageBps'>>,
  ctx: { headcount: number; payrollGrossTotal?: number },
): number {
  return roundMoney(lines.reduce((sum, line) => sum + computeRateCardLineAmount(line, ctx), 0));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function outsourcingClientStatusLabel(status: OutsourcingClientStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'suspended':
      return 'Suspended';
    case 'churned':
      return 'Churned';
    default:
      return status;
  }
}
