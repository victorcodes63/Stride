import { slugToCountryCode } from '@/lib/operating-entities';

export type EntityId = 'ug' | 'ke';

export type StatutoryItemConfig = {
  key: string;
  label: string;
  sublabel: string;
  type: 'employee' | 'employer' | 'both';
  badge: string;
};

export type EntityConfig = {
  currency: {
    code: string;
    symbol: string;
    locale: string;
    decimals: number;
  };
  payroll: {
    runLabel: string;
    taxAuthority: string;
    taxLabel: string;
    taxPinLabel: string;
    statutoryItems: StatutoryItemConfig[];
    reportLabels: {
      monthly: string;
      annual: string;
    };
    /** Table / payslip column titles mapped to API fields */
    deductionColumnHeaders: {
      paye: string;
      nssf: string;
      nhif: string;
      ahl: string;
      nita: string;
    };
    /** Intro line for statutory / compliance panels */
    statutoryComplianceIntro: string;
    missingHealthSchemeGapLabel: string;
  };
  tax: {
    vatRate: string;
    vatLabel: string;
    whtLabel: string;
    whtRates: string;
  };
};

const KE: EntityConfig = {
  currency: {
    code: 'KES',
    symbol: 'KSh',
    locale: 'en-KE',
    decimals: 2,
  },
  payroll: {
    runLabel: 'Kenya Payroll',
    taxAuthority: 'KRA',
    taxLabel: 'KRA PAYE',
    taxPinLabel: 'KRA PIN',
    statutoryItems: [
      {
        key: 'paye',
        label: 'KRA PAYE',
        sublabel: 'PAYE per KRA bands',
        type: 'both',
        badge: 'PAYE',
      },
      {
        key: 'nssf',
        label: 'NSSF (New Act)',
        sublabel: 'Employee 6% · Employer 6%',
        type: 'both',
        badge: 'NSSF',
      },
      {
        key: 'sha',
        label: 'SHA Levy (formerly NHIF)',
        sublabel: 'Employee 2.75%',
        type: 'employee',
        badge: 'SHA',
      },
      {
        key: 'ahl',
        label: 'Affordable Housing Levy',
        sublabel: 'Employee 1.5% · Employer 1.5%',
        type: 'both',
        badge: 'AHL',
      },
      {
        key: 'nita',
        label: 'NITA Levy',
        sublabel: '0.5% of gross',
        type: 'employer',
        badge: 'NITA',
      },
    ],
    reportLabels: {
      monthly: 'P10 Return',
      annual: 'P9A Form',
    },
    deductionColumnHeaders: {
      paye: 'KRA PAYE',
      nssf: 'NSSF',
      nhif: 'SHA',
      ahl: 'AHL',
      nita: 'NITA (emp.)',
    },
    statutoryComplianceIntro:
      'Monthly compliance center for KRA PAYE, NSSF, SHA, and Housing Levy remittances.',
    missingHealthSchemeGapLabel: 'SHA number',
  },
  tax: {
    vatRate: '16%',
    vatLabel: 'VAT (16%)',
    whtLabel: 'Withholding Tax',
    whtRates: '5% / 10%',
  },
};

const UG: EntityConfig = {
  currency: {
    code: 'UGX',
    symbol: 'USh',
    locale: 'en-UG',
    decimals: 0,
  },
  payroll: {
    runLabel: 'Uganda Payroll',
    taxAuthority: 'URA',
    taxLabel: 'URA PAYE',
    taxPinLabel: 'URA TIN',
    statutoryItems: [
      {
        key: 'paye',
        label: 'URA PAYE',
        sublabel: 'PAYE per URA bands',
        type: 'both',
        badge: 'PAYE',
      },
      {
        key: 'nssf',
        label: 'NSSF Uganda',
        sublabel: 'Employee 5% · Employer 10%',
        type: 'both',
        badge: 'NSSF',
      },
      {
        key: 'nita-u',
        label: 'NITA-U Levy',
        sublabel: '1% of gross',
        type: 'employer',
        badge: 'NITA-U',
      },
    ],
    reportLabels: {
      monthly: 'URA Monthly Return',
      annual: 'URA Annual Return',
    },
    deductionColumnHeaders: {
      paye: 'URA PAYE',
      nssf: 'NSSF',
      nhif: 'Scheme contribution',
      ahl: 'Housing levy',
      nita: 'NITA-U (emp.)',
    },
    statutoryComplianceIntro:
      'Monthly compliance center for URA PAYE, NSSF, and NITA-U remittances.',
    missingHealthSchemeGapLabel: 'Statutory scheme reference',
  },
  tax: {
    vatRate: '18%',
    vatLabel: 'VAT (18%)',
    whtLabel: 'Withholding Tax',
    whtRates: '6% / 15%',
  },
};

export function getEntityConfig(entityId: EntityId): EntityConfig {
  return entityId === 'ug' ? UG : KE;
}

/** Resolve statutory config from any entity slug (maps via country code). */
export function getEntityConfigForSlug(slug: string): EntityConfig {
  return slugToCountryCode(slug) === 'UG' ? UG : KE;
}

/** Display money using locale/decimals for the ISO currency (maps KES/UGX to entity configs). */
export function formatDisplayMoney(amount: number, currencyCode: string): string {
  if (currencyCode !== 'UGX' && currencyCode !== 'KES') {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
  }
  const id: EntityId = currencyCode === 'UGX' ? 'ug' : 'ke';
  const c = getEntityConfig(id).currency;
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(amount);
}

/**
 * Maps demo station / site names to the dashboard entity switcher (Uganda vs Kenya).
 * Used to scope static HRIS demo views until APIs are entity-aware.
 */
export function stationBelongsToEntity(station: string, entityId: EntityId): boolean {
  if (/Nairobi|Mombasa|Nakuru/i.test(station)) return entityId === 'ke';
  if (/Kampala|Jinja|Entebbe|Nansana/i.test(station)) return entityId === 'ug';
  return entityId === 'ug';
}
