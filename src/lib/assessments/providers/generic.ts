import type { AssessmentProviderKey } from '@prisma/client';
import { BaseRestProvider } from './base';
import type { AssessmentProviderAdapter, ProviderContext } from './types';

/**
 * Standards-based REST + webhook adapter. Any provider that exposes a bearer-auth
 * REST API can be connected without a bespoke adapter by pointing baseUrl at it and
 * (optionally) overriding endpoint paths via credentials { catalogPath, invitePath }.
 */
export class GenericRestProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'generic';
  readonly label = 'Generic REST provider';
  readonly credentialFields: AssessmentProviderAdapter['credentialFields'] = [
    { key: 'apiKey', label: 'API key / client id', secret: true },
    { key: 'clientSecret', label: 'Client secret (OAuth only)', secret: true, optional: true },
    { key: 'catalogPath', label: 'Catalog path (e.g. /assessments)', optional: true },
    { key: 'invitePath', label: 'Invite path (e.g. /invitations)', optional: true },
  ];

  protected defaultBaseUrl(): string {
    return 'https://api.example-assessments.com/v1';
  }

  protected override baseUrl(ctx: ProviderContext): string {
    return (ctx.baseUrl?.trim() || this.defaultBaseUrl()).replace(/\/$/, '');
  }

  constructor(ctx?: ProviderContext) {
    super();
    if (ctx?.credentials.catalogPath) this.paths.catalog = String(ctx.credentials.catalogPath);
    if (ctx?.credentials.invitePath) this.paths.invite = String(ctx.credentials.invitePath);
  }
}
