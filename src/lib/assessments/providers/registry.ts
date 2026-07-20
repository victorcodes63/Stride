import type { AssessmentProviderKey } from '@prisma/client';
import type { AssessmentProviderAdapter, ProviderContext } from './types';
import { GenericRestProvider } from './generic';
import {
  BigFiveProvider,
  CriteriaProvider,
  DiscProvider,
  HireVueProvider,
  HoganProvider,
  PredictiveIndexProvider,
  ShlProvider,
} from './vendors';

/**
 * Resolve the adapter for a provider. The generic adapter is context-aware
 * (endpoint overrides via credentials), so it is constructed per-call.
 */
export function getProviderAdapter(
  provider: AssessmentProviderKey,
  ctx?: ProviderContext,
): AssessmentProviderAdapter {
  switch (provider) {
    case 'generic':
      return new GenericRestProvider(ctx);
    case 'criteria':
      return new CriteriaProvider();
    case 'shl':
      return new ShlProvider();
    case 'hogan':
      return new HoganProvider();
    case 'predictive_index':
      return new PredictiveIndexProvider();
    case 'disc':
      return new DiscProvider();
    case 'big_five':
      return new BigFiveProvider();
    case 'hirevue':
      return new HireVueProvider();
    default:
      return new GenericRestProvider(ctx);
  }
}

export const PROVIDER_KEYS: AssessmentProviderKey[] = [
  'generic',
  'criteria',
  'shl',
  'hogan',
  'predictive_index',
  'disc',
  'big_five',
  'hirevue',
];

export function providerLabel(provider: AssessmentProviderKey): string {
  return getProviderAdapter(provider).label;
}

export function providerCredentialFields(provider: AssessmentProviderKey) {
  return getProviderAdapter(provider).credentialFields;
}
