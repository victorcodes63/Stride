/**
 * RAV-177 — Daraja B2C production readiness checklist.
 */
import {
  darajaCredentialsConfigured,
  getB2CQueueTimeoutUrl,
  getB2CResultUrl,
  getDarajaBaseUrl,
} from '@/lib/payroll-disbursement/daraja-client';

export type MpesaProductionReadiness = {
  provider: string;
  env: string;
  baseUrl: string;
  credentialsConfigured: boolean;
  callbackBaseConfigured: boolean;
  resultUrlConfigured: boolean;
  timeoutUrlConfigured: boolean;
  ready: boolean;
  missing: string[];
};

export function assessMpesaProductionReadiness(): MpesaProductionReadiness {
  const provider = (process.env.MPESA_PROVIDER ?? 'simulated').trim().toLowerCase();
  const env = (process.env.MPESA_ENV ?? 'sandbox').trim().toLowerCase();
  const missing: string[] = [];

  if (provider !== 'daraja') {
    missing.push('Set MPESA_PROVIDER=daraja for live disbursements.');
  }
  if (!darajaCredentialsConfigured()) {
    missing.push(
      'Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_INITIATOR_NAME, MPESA_SECURITY_CREDENTIAL.',
    );
  }

  const callbackBase = process.env.MPESA_CALLBACK_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!callbackBase) {
    missing.push('Set MPESA_CALLBACK_BASE_URL or NEXT_PUBLIC_APP_URL for B2C webhooks.');
  }

  const resultUrl = getB2CResultUrl();
  const timeoutUrl = getB2CQueueTimeoutUrl();
  if (!resultUrl) missing.push('B2C result callback URL could not be resolved.');
  if (!timeoutUrl) missing.push('B2C timeout callback URL could not be resolved.');

  if (env !== 'production' && provider === 'daraja') {
    missing.push('Set MPESA_ENV=production when going live (sandbox is fine for UAT).');
  }

  return {
    provider,
    env,
    baseUrl: getDarajaBaseUrl(),
    credentialsConfigured: darajaCredentialsConfigured(),
    callbackBaseConfigured: Boolean(callbackBase),
    resultUrlConfigured: Boolean(resultUrl),
    timeoutUrlConfigured: Boolean(timeoutUrl),
    ready: missing.length === 0 && provider === 'daraja',
    missing,
  };
}
