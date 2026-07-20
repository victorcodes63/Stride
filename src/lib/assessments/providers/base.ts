import { createHmac, timingSafeEqual } from 'crypto';
import type { AssessmentProviderKey } from '@prisma/client';
import type { NormalizedResult } from '@/lib/assessments/types';
import { percentToPercentile, percentToSten } from '@/lib/assessments/scoring-normalization';
import {
  ProviderError,
  type AssessmentProviderAdapter,
  type ProviderCatalogItem,
  type ProviderContext,
  type ProviderInviteInput,
  type ProviderInviteResult,
  type ProviderResult,
  type ProviderWebhookParsed,
} from './types';

/**
 * Shared REST provider. Concrete adapters mostly configure endpoint paths and a
 * dimension map; the HTTP + OAuth + normalisation plumbing lives here, mirroring
 * the Daraja client pattern (token cache + bearer auth).
 */
export abstract class BaseRestProvider implements AssessmentProviderAdapter {
  abstract readonly key: AssessmentProviderKey;
  abstract readonly label: string;
  abstract readonly credentialFields: AssessmentProviderAdapter['credentialFields'];

  /** Default base URL when the connection does not override it. */
  protected abstract defaultBaseUrl(): string;

  /** Endpoint paths relative to the base URL. */
  protected paths = {
    token: '/oauth/token',
    catalog: '/assessments',
    invite: '/invitations',
    result: (inviteId: string) => `/invitations/${inviteId}/result`,
  };

  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  protected baseUrl(ctx: ProviderContext): string {
    return (ctx.baseUrl?.trim() || this.defaultBaseUrl()).replace(/\/$/, '');
  }

  /** OAuth2 client-credentials token, cached per credential set. */
  protected async accessToken(ctx: ProviderContext): Promise<string> {
    const clientId = String(ctx.credentials.clientId ?? ctx.credentials.apiKey ?? '');
    const clientSecret = String(ctx.credentials.clientSecret ?? ctx.credentials.apiSecret ?? '');
    // API-key style providers: use the key directly as a bearer token.
    if (clientId && !clientSecret) return clientId;

    const cacheKey = `${this.key}:${clientId}`;
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 30_000) return cached.token;

    const res = await fetch(`${this.baseUrl(ctx)}${this.paths.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new ProviderError(data.error || `${this.label} auth failed (${res.status})`);
    }
    const expiresIn = Number(data.expires_in ?? 3600);
    this.tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAt: now + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    });
    return data.access_token;
  }

  protected async request<T>(
    ctx: ProviderContext,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const token = await this.accessToken(ctx);
    const res = await fetch(`${this.baseUrl(ctx)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new ProviderError(
        (data as { message?: string }).message || `${this.label} request failed (${res.status})`,
        res.status,
      );
    }
    return data as T;
  }

  async listCatalog(ctx: ProviderContext): Promise<ProviderCatalogItem[]> {
    const data = await this.request<{ items?: unknown[]; assessments?: unknown[] }>(ctx, this.paths.catalog);
    const items = (data.items ?? data.assessments ?? []) as Array<Record<string, unknown>>;
    return items.map((item) => this.mapCatalogItem(item));
  }

  protected mapCatalogItem(item: Record<string, unknown>): ProviderCatalogItem {
    return {
      externalId: String(item.id ?? item.externalId ?? item.assessmentId ?? ''),
      name: String(item.name ?? item.title ?? 'Untitled assessment'),
      description: (item.description as string) ?? null,
      category: (item.category as string) ?? null,
      durationMinutes: item.durationMinutes ? Number(item.durationMinutes) : null,
      dimensions: Array.isArray(item.dimensions) ? (item.dimensions as string[]) : this.knownDimensions(),
    };
  }

  async invite(ctx: ProviderContext, input: ProviderInviteInput): Promise<ProviderInviteResult> {
    const data = await this.request<Record<string, unknown>>(ctx, this.paths.invite, {
      method: 'POST',
      body: JSON.stringify({
        assessmentId: input.externalId,
        candidate: input.candidate,
        callbackUrl: input.callbackUrl,
        redirectUrl: input.redirectUrl,
        metadata: input.metadata,
      }),
    });
    return {
      externalInviteId: String(data.id ?? data.invitationId ?? '') || null,
      candidateUrl: (data.url as string) ?? (data.candidateUrl as string) ?? null,
      status: 'invited',
      raw: data,
    };
  }

  async getResults(ctx: ProviderContext, externalInviteId: string): Promise<ProviderResult | null> {
    const data = await this.request<Record<string, unknown>>(ctx, this.paths.result(externalInviteId));
    if (!data || Object.keys(data).length === 0) return null;
    const status = String(data.status ?? 'completed');
    return {
      status: status === 'completed' || data.score !== undefined ? 'completed' : 'in_progress',
      rawResult: data,
      normalized: this.normalize(data),
      completedAt: data.completedAt ? new Date(String(data.completedAt)) : new Date(),
    };
  }

  async verifyWebhook(ctx: ProviderContext, headers: Headers, rawBody: string): Promise<boolean> {
    const secret = ctx.webhookSecret?.trim();
    if (!secret) return true; // no secret configured -> accept (dev)
    const signature =
      headers.get('x-signature') ||
      headers.get('x-webhook-signature') ||
      headers.get('x-hub-signature-256') ||
      '';
    if (!signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  parseWebhook(_ctx: ProviderContext, body: unknown): ProviderWebhookParsed | null {
    if (!body || typeof body !== 'object') return null;
    const data = body as Record<string, unknown>;
    const status = String(data.status ?? data.event ?? 'completed');
    return {
      externalInviteId: String(data.invitationId ?? data.inviteId ?? data.id ?? '') || null,
      externalId: String(data.assessmentId ?? '') || null,
      candidateEmail: (data.candidateEmail as string) ?? null,
      status: status.includes('progress') ? 'in_progress' : status.includes('error') ? 'error' : 'completed',
      rawResult: data,
      normalized: this.normalize(data),
    };
  }

  /** Providers that measure fixed dimensions declare them here. */
  protected knownDimensions(): string[] {
    return [];
  }

  /** Turn a provider's raw payload into the shared normalised shape. */
  normalize(raw: Record<string, unknown>): NormalizedResult {
    const scorePercent = extractPercent(raw);
    const dimensions = extractDimensions(raw, this.knownDimensions());
    return {
      scorePercent,
      percentile:
        raw.percentile !== undefined
          ? Number(raw.percentile)
          : scorePercent !== null
            ? percentToPercentile(scorePercent)
            : null,
      sten: raw.sten !== undefined ? Number(raw.sten) : scorePercent !== null ? percentToSten(scorePercent) : null,
      dimensions: Object.keys(dimensions).length ? dimensions : undefined,
      raw,
    };
  }
}

function extractPercent(raw: Record<string, unknown>): number | null {
  const candidates = [raw.scorePercent, raw.percent, raw.score, raw.overallScore];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const n = Number(c);
    if (!Number.isNaN(n)) return n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100;
  }
  return null;
}

function extractDimensions(raw: Record<string, unknown>, known: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const source = (raw.dimensions ?? raw.scales ?? raw.traits) as Record<string, unknown> | undefined;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [k, v] of Object.entries(source)) {
      const n = Number(v);
      if (!Number.isNaN(n)) out[k] = n <= 1 ? Math.round(n * 10000) / 100 : n;
    }
  }
  // Ensure known dimensions appear even if absent (0), so radar charts are stable.
  for (const dim of known) if (!(dim in out)) out[dim] = out[dim] ?? 0;
  return out;
}
