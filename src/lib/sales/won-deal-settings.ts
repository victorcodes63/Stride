/**
 * B4 — Org-level won-deal automation toggles (SystemSetting JSON).
 */
import type { Prisma } from '@prisma/client';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';

export const WON_DEAL_SETTINGS_KEY = 'sales.won-deal.automation';

export type WonDealAutomationSettings = {
  /** Block win unless a linked accepted quote exists. */
  requireAcceptedQuote: boolean;
  /** Auto-create Finance invoice on win (prefer accepted quote). */
  autoCreateInvoice: boolean;
  /** Auto-create SalesActual on win (idempotent per deal). */
  autoCreateSalesActual: boolean;
  /** Create a delivery Project linked via sourceDealId. */
  createDeliveryProject: boolean;
  /** When fleet is licensed, prompt (do not auto-create) a FleetOrder. */
  offerFleetOrder: boolean;
};

export const DEFAULT_WON_DEAL_SETTINGS: WonDealAutomationSettings = {
  requireAcceptedQuote: false,
  autoCreateInvoice: false,
  autoCreateSalesActual: false,
  createDeliveryProject: false,
  offerFleetOrder: false,
};

type Tx = Prisma.TransactionClient;

function sanitize(raw: unknown): WonDealAutomationSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    requireAcceptedQuote: src.requireAcceptedQuote === true,
    autoCreateInvoice: src.autoCreateInvoice === true,
    autoCreateSalesActual: src.autoCreateSalesActual === true,
    createDeliveryProject: src.createDeliveryProject === true,
    offerFleetOrder: src.offerFleetOrder === true,
  };
}

export async function loadWonDealSettings(
  tx: Tx,
  organizationId: string,
): Promise<WonDealAutomationSettings> {
  const row = await tx.systemSetting.findUnique({
    where: systemSettingWhere(organizationId, WON_DEAL_SETTINGS_KEY),
  });
  if (!row) return { ...DEFAULT_WON_DEAL_SETTINGS };
  return sanitize(row.value);
}

export async function saveWonDealSettings(
  tx: Tx,
  organizationId: string,
  next: Partial<WonDealAutomationSettings>,
  updatedByUserId?: string | null,
): Promise<WonDealAutomationSettings> {
  const current = await loadWonDealSettings(tx, organizationId);
  const merged = sanitize({ ...current, ...next });
  await tx.systemSetting.upsert({
    where: systemSettingWhere(organizationId, WON_DEAL_SETTINGS_KEY),
    create: systemSettingCreate(
      organizationId,
      WON_DEAL_SETTINGS_KEY,
      merged as unknown as Prisma.InputJsonValue,
      updatedByUserId,
    ),
    update: {
      value: merged as unknown as Prisma.InputJsonValue,
      updatedByUserId: updatedByUserId ?? null,
    },
  });
  return merged;
}
