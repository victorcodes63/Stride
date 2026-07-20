import type { Prisma } from '@prisma/client';
import { CountryPackKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_KENYA_STATUTORY_RATES,
  KENYA_HOLIDAYS_2026,
  KENYA_LOCALE_PACK,
  TANZANIA_STATUTORY_STUB,
  UGANDA_STATUTORY_STUB,
  parseKenyaStatutory,
  resolvePayrollCountry,
  type CountryHolidayConfig,
  type CountryLocaleConfig,
  type KenyaStatutoryRates,
} from './constants';

// Re-export the pure constants/types so existing `@/lib/country-config` importers
// keep working. Prisma-free consumers should import from `./constants` directly.
export {
  DEFAULT_KENYA_STATUTORY_RATES,
  KENYA_HOLIDAYS_2026,
  KENYA_LOCALE_PACK,
  TANZANIA_STATUTORY_STUB,
  UGANDA_STATUTORY_STUB,
  parseKenyaStatutory,
  resolvePayrollCountry,
} from './constants';
export type {
  CountryHolidayConfig,
  CountryLocaleConfig,
  KenyaStatutoryRates,
} from './constants';

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
