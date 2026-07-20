export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'none';

export const DEPRECIATION_METHODS: { value: DepreciationMethod; label: string }[] = [
  { value: 'straight_line', label: 'Straight line' },
  { value: 'declining_balance', label: 'Declining balance' },
  { value: 'none', label: 'No depreciation' },
];

export function parseDepreciationMethod(value: unknown): DepreciationMethod {
  return value === 'straight_line' || value === 'declining_balance' || value === 'none'
    ? value
    : 'straight_line';
}

export function depreciationMethodLabel(value: string | null): string {
  return DEPRECIATION_METHODS.find((m) => m.value === value)?.label ?? 'Straight line';
}

export type DepreciationInput = {
  purchaseCost: number | null;
  salvageValue: number | null;
  usefulLifeMonths: number | null;
  purchaseDate: string | Date | null;
  method: string | null;
  asOf?: Date;
};

export type DepreciationResult = {
  method: DepreciationMethod;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number | null;
  monthsElapsed: number;
  monthlyDepreciation: number | null;
  accumulatedDepreciation: number;
  bookValue: number;
  fullyDepreciated: boolean;
};

function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const dayAdjust = to.getDate() < from.getDate() ? -1 : 0;
  return Math.max(0, months + dayAdjust);
}

/**
 * Current book value using straight-line (default) or double-declining-balance.
 * Returns null when there is no purchase cost to depreciate.
 */
export function computeDepreciation(input: DepreciationInput): DepreciationResult | null {
  const cost = input.purchaseCost;
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null;

  const method = parseDepreciationMethod(input.method);
  const salvage = Math.min(
    Math.max(0, input.salvageValue ?? 0),
    cost,
  );
  const asOf = input.asOf ?? new Date();
  const purchaseDate =
    input.purchaseDate == null
      ? null
      : input.purchaseDate instanceof Date
        ? input.purchaseDate
        : new Date(input.purchaseDate);
  const validPurchaseDate =
    purchaseDate && !Number.isNaN(purchaseDate.getTime()) ? purchaseDate : null;
  const monthsElapsed = validPurchaseDate ? monthsBetween(validPurchaseDate, asOf) : 0;

  if (method === 'none') {
    return {
      method,
      purchaseCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: input.usefulLifeMonths ?? null,
      monthsElapsed,
      monthlyDepreciation: null,
      accumulatedDepreciation: 0,
      bookValue: round2(cost),
      fullyDepreciated: false,
    };
  }

  const life = input.usefulLifeMonths;
  if (!life || life <= 0) {
    return {
      method,
      purchaseCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: life ?? null,
      monthsElapsed,
      monthlyDepreciation: null,
      accumulatedDepreciation: 0,
      bookValue: round2(cost),
      fullyDepreciated: false,
    };
  }

  const depreciableBase = Math.max(0, cost - salvage);

  if (method === 'straight_line') {
    const monthly = depreciableBase / life;
    const accumulated = Math.min(depreciableBase, monthly * monthsElapsed);
    const bookValue = Math.max(salvage, cost - accumulated);
    return {
      method,
      purchaseCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: life,
      monthsElapsed,
      monthlyDepreciation: round2(monthly),
      accumulatedDepreciation: round2(accumulated),
      bookValue: round2(bookValue),
      fullyDepreciated: bookValue <= salvage + 0.01,
    };
  }

  // Double declining balance.
  const monthlyRate = 2 / life;
  let value = cost;
  for (let i = 0; i < monthsElapsed; i += 1) {
    if (value <= salvage) {
      value = salvage;
      break;
    }
    value = Math.max(salvage, value - value * monthlyRate);
  }
  const accumulated = cost - value;
  return {
    method,
    purchaseCost: cost,
    salvageValue: salvage,
    usefulLifeMonths: life,
    monthsElapsed,
    monthlyDepreciation: round2(cost * monthlyRate),
    accumulatedDepreciation: round2(accumulated),
    bookValue: round2(value),
    fullyDepreciated: value <= salvage + 0.01,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
