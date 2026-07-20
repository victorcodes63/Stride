import type { AssessmentProviderKey } from '@prisma/client';
import type { NormalizedResult } from '@/lib/assessments/types';

export type ProviderCredentials = Record<string, unknown>;

export type ProviderContext = {
  baseUrl?: string | null;
  credentials: ProviderCredentials;
  webhookSecret?: string | null;
};

export type ProviderCatalogItem = {
  externalId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  durationMinutes?: number | null;
  dimensions?: string[];
};

export type ProviderInviteInput = {
  externalId: string;
  candidate: { firstName: string; lastName: string; email: string };
  /** Where the provider should POST results. */
  callbackUrl: string;
  /** Where the candidate returns after completing. */
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderInviteResult = {
  externalInviteId?: string | null;
  candidateUrl?: string | null;
  status: 'pending' | 'invited' | 'error';
  costCents?: number | null;
  currency?: string;
  raw?: Record<string, unknown>;
};

export type ProviderResult = {
  status: 'in_progress' | 'completed' | 'error';
  rawResult: Record<string, unknown>;
  normalized: NormalizedResult;
  completedAt?: Date | null;
};

export type ProviderWebhookParsed = {
  externalInviteId?: string | null;
  externalId?: string | null;
  candidateEmail?: string | null;
  status: 'in_progress' | 'completed' | 'error';
  rawResult: Record<string, unknown>;
  normalized: NormalizedResult;
};

export interface AssessmentProviderAdapter {
  readonly key: AssessmentProviderKey;
  readonly label: string;
  /** Fields the connection form should collect (rendered by the UI). */
  readonly credentialFields: Array<{ key: string; label: string; secret?: boolean; optional?: boolean }>;

  /** List assessments available in the provider account. */
  listCatalog(ctx: ProviderContext): Promise<ProviderCatalogItem[]>;
  /** Invite a candidate to a specific assessment. */
  invite(ctx: ProviderContext, input: ProviderInviteInput): Promise<ProviderInviteResult>;
  /** Poll for a result (fallback when webhooks are unavailable). */
  getResults(ctx: ProviderContext, externalInviteId: string): Promise<ProviderResult | null>;
  /** Validate an inbound webhook (signature / secret). */
  verifyWebhook(ctx: ProviderContext, headers: Headers, rawBody: string): Promise<boolean>;
  /** Parse an inbound webhook payload into a normalised result. */
  parseWebhook(ctx: ProviderContext, body: unknown): ProviderWebhookParsed | null;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}
