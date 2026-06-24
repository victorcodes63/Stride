import type { Prisma } from '@prisma/client';
import { CountryPackKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Kenya statutory rates shape stored in country_config.config (JSON). */
export type KenyaStatutoryRates = {
  payeBands: Array<{ max: number; rate: number }>;
  personalRelief: number;
  shifRate: number;
  nssfTier1Limit: number;
  nssfTier2Limit: number;
  nssfRate: number;
  ahlRate: number;
  nitaPerEmployee: number;
};

export type CountryLocaleConfig = {
  currency: string;
  locale: string;
  timezone: string;
};

export type CountryHolidayConfig = {
  holidays: Array<{ date: string; name: string }>;
};

export const DEFAULT_KENYA_STATUTORY_RATES: KenyaStatutoryRates = {
  payeBands: [
    { max: 24_000, rate: 0.1 },
    { max: 32_333, rate: 0.25 },
    { max: 500_000, rate: 0.3 },
    { max: 800_000, rate: 0.325 },
    { max: Number.POSITIVE_INFINITY, rate: 0.35 },
  ],
  personalRelief: 2_400,
  shifRate: 0.0275,
  nssfTier1Limit: 9_000,
  nssfTier2Limit: 108_000,
  nssfRate: 0.06,
  ahlRate: 0.015,
  nitaPerEmployee: 50,
};

export const KENYA_LOCALE_PACK: CountryLocaleConfig = {
  currency: 'KES',
  locale: 'en-KE',
  timezone: 'Africa/Nairobi',
};

/** 2026 Kenya public holidays (config-only; extend per year in DB). */
export const KENYA_HOLIDAYS_2026: CountryHolidayConfig = {
  holidays: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-06-01', name: 'Madaraka Day' },
    { date: '2026-10-10', name: 'Huduma Day' },
    { date: '2026-10-20', name: 'Mashujaa Day' },
    { date: '2026-12-12', name: 'Jamhuri Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-26', name: 'Boxing Day' },
  ],
};

export const UGANDA_STATUTORY_STUB: KenyaStatutoryRates = {
  payeBands: [{ max: Number.POSITIVE_INFINITY, rate: 0 }],
  personalRelief: 0,
  shifRate: 0,
  nssfTier1Limit: 0,
  nssfTier2Limit: 0,
  nssfRate: 0,
  ahlRate: 0,
  nitaPerEmployee: 0,
};

export const TANZANIA_STATUTORY_STUB: KenyaStatutoryRates = {
  ...UGANDA_STATUTORY_STUB,
};

function parseKenyaStatutory(config: unknown): KenyaStatutoryRates {
  const c = config as Partial<KenyaStatutoryRates>;
  return {
    payeBands: c.payeBands ?? DEFAULT_KENYA_STATUTORY_RATES.payeBands,
    personalRelief: c.personalRelief ?? DEFAULT_KENYA_STATUTORY_RATES.personalRelief,
    shifRate: c.shifRate ?? DEFAULT_KENYA_STATUTORY_RATES.shifRate,
    nssfTier1Limit: c.nssfTier1Limit ?? DEFAULT_KENYA_STATUTORY_RATES.nssfTier1Limit,
    nssfTier2Limit: c.nssfTier2Limit ?? DEFAULT_KENYA_STATUTORY_RATES.nssfTier2Limit,
    nssfRate: c.nssfRate ?? DEFAULT_KENYA_STATUTORY_RATES.nssfRate,
    ahlRate: c.ahlRate ?? DEFAULT_KENYA_STATUTORY_RATES.ahlRate,
    nitaPerEmployee: c.nitaPerEmployee ?? DEFAULT_KENYA_STATUTORY_RATES.nitaPerEmployee,
  };
}

function activeWhere(country: string, kind: CountryPackKind, asOf: Date): Prisma.CountryConfigWhereInput {
  return {
    country,
    kind,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  };
}

export async function getCountryConfigRow(
  country: string,
  kind: CountryPackKind,
  asOf: Date = new Date(),
) {
  if (!process.env.DATABASE_URL) return null;
  return prisma.countryConfig.findFirst({
    where: activeWhere(country.toUpperCase(), kind, asOf),
    orderBy: { effectiveFrom: 'desc' },
  });
}

export async function getStatutoryRates(
  country: string,
  asOf: Date = new Date(),
): Promise<KenyaStatutoryRates> {
  const row = await getCountryConfigRow(country, CountryPackKind.statutory, asOf);
  if (!row) {
    if (country.toUpperCase() === 'KE') return DEFAULT_KENYA_STATUTORY_RATES;
    if (country.toUpperCase() === 'UG') return UGANDA_STATUTORY_STUB;
    if (country.toUpperCase() === 'TZ') return TANZANIA_STATUTORY_STUB;
    return DEFAULT_KENYA_STATUTORY_RATES;
  }
  return parseKenyaStatutory(row.config);
}

export async function getLocalePack(
  country: string,
  asOf: Date = new Date(),
): Promise<CountryLocaleConfig> {
  const row = await getCountryConfigRow(country, CountryPackKind.locale, asOf);
  if (!row) {
    if (country.toUpperCase() === 'UG') {
      return { currency: 'UGX', locale: 'en-UG', timezone: 'Africa/Kampala' };
    }
    if (country.toUpperCase() === 'TZ') {
      return { currency: 'TZS', locale: 'sw-TZ', timezone: 'Africa/Dar_es_Salaam' };
    }
    return KENYA_LOCALE_PACK;
  }
  const c = row.config as Partial<CountryLocaleConfig>;
  return {
    currency: c.currency ?? 'KES',
    locale: c.locale ?? 'en-KE',
    timezone: c.timezone ?? 'Africa/Nairobi',
  };
}

export async function getHolidayPack(
  country: string,
  asOf: Date = new Date(),
): Promise<CountryHolidayConfig> {
  const row = await getCountryConfigRow(country, CountryPackKind.holidays, asOf);
  if (!row) {
    if (country.toUpperCase() === 'KE') return KENYA_HOLIDAYS_2026;
    return { holidays: [] };
  }
  const c = row.config as Partial<CountryHolidayConfig>;
  return { holidays: c.holidays ?? [] };
}

/** Map outsourcing entityCode / org country to ISO country code. */
export function resolvePayrollCountry(input: {
  organizationCountry?: string | null;
  entityCode?: string | null;
}): string {
  const entity = input.entityCode?.toLowerCase();
  if (entity === 'ug') return 'UG';
  if (entity === 'tz') return 'TZ';
  if (entity === 'ke') return 'KE';
  return (input.organizationCountry ?? 'KE').toUpperCase();
}

/** Load statutory rates for payroll using client entity + org country (RAV-65). */
export async function getPayrollStatutoryRates(input: {
  clientId: string;
  organizationId?: string | null;
  asOf?: Date;
}): Promise<KenyaStatutoryRates> {
  const [client, org] = await Promise.all([
    prisma.outsourcingClient.findUnique({
      where: { id: input.clientId },
      select: { entityCode: true },
    }),
    input.organizationId
      ? prisma.organization.findUnique({
          where: { id: input.organizationId },
          select: { country: true },
        })
      : Promise.resolve(null),
  ]);
  const country = resolvePayrollCountry({
    entityCode: client?.entityCode,
    organizationCountry: org?.country,
  });
  return getStatutoryRates(country, input.asOf);
}

/** Batch resolver when generating payroll across multiple outsourcing clients. */
export async function getPayrollStatutoryRatesByClient(
  clientIds: string[],
  organizationId?: string | null,
  asOf?: Date,
): Promise<Map<string, KenyaStatutoryRates>> {
  const unique = [...new Set(clientIds)];
  const org = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { country: true },
      })
    : null;
  const clients = await prisma.outsourcingClient.findMany({
    where: { id: { in: unique } },
    select: { id: true, entityCode: true },
  });
  const map = new Map<string, KenyaStatutoryRates>();
  await Promise.all(
    clients.map(async (client) => {
      const country = resolvePayrollCountry({
        entityCode: client.entityCode,
        organizationCountry: org?.country,
      });
      map.set(client.id, await getStatutoryRates(country, asOf));
    }),
  );
  return map;
}
