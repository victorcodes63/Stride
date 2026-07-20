import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { getProviderAdapter, PROVIDER_KEYS } from '@/lib/assessments/providers/registry';
import { credentialCryptoConfigured } from '@/lib/assessments/crypto';
import { ALL_QUESTION_TYPES, QUESTION_TYPE_LABELS } from '@/lib/assessments/types';

/** Static metadata for the builder + integrations UI (provider list, question types). */
export async function GET(request: NextRequest) {
  return withTenant(request, async () => {
    const providers = PROVIDER_KEYS.map((key) => {
      const adapter = getProviderAdapter(key);
      return { key, label: adapter.label, credentialFields: adapter.credentialFields };
    });
    return NextResponse.json({
      providers,
      credentialStorageReady: credentialCryptoConfigured(),
      questionTypes: ALL_QUESTION_TYPES.map((type) => ({ type, label: QUESTION_TYPE_LABELS[type] })),
    });
  });
}
