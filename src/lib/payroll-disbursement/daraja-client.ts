/**
 * Safaricom Daraja OAuth + B2C payment request helpers.
 * @see https://developer.safaricom.co.ke/APIs/MpesaApis
 */

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE = 'https://api.safaricom.co.ke';

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export function getDarajaBaseUrl(): string {
  const env = (process.env.MPESA_ENV ?? 'sandbox').trim().toLowerCase();
  return env === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

export function getDarajaCredentials() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim() ?? '';
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim() ?? '';
  const shortcode = process.env.MPESA_SHORTCODE?.trim() ?? '';
  const initiatorName = process.env.MPESA_INITIATOR_NAME?.trim() ?? '';
  const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL?.trim() ?? '';
  return { consumerKey, consumerSecret, shortcode, initiatorName, securityCredential };
}

export function darajaCredentialsConfigured(): boolean {
  const c = getDarajaCredentials();
  return Boolean(
    c.consumerKey && c.consumerSecret && c.shortcode && c.initiatorName && c.securityCredential,
  );
}

function appBaseUrl(): string {
  const fromEnv =
    process.env.MPESA_CALLBACK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!fromEnv) return '';
  return fromEnv.startsWith('http') ? fromEnv.replace(/\/$/, '') : `https://${fromEnv}`;
}

export function getB2CResultUrl(): string {
  const explicit = process.env.MPESA_B2C_RESULT_URL?.trim();
  if (explicit) return explicit;
  const base = appBaseUrl();
  return base ? `${base}/api/webhooks/mpesa/b2c/result` : '';
}

export function getB2CQueueTimeoutUrl(): string {
  const explicit = process.env.MPESA_B2C_QUEUE_TIMEOUT_URL?.trim();
  if (explicit) return explicit;
  const base = appBaseUrl();
  return base ? `${base}/api/webhooks/mpesa/b2c/timeout` : '';
}

export async function getDarajaAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  const { consumerKey, consumerSecret } = getDarajaCredentials();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(`${getDarajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: string | number;
    errorMessage?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.errorMessage || `Daraja OAuth failed (${res.status})`);
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
  return data.access_token;
}

export type B2CPaymentResponse = {
  originatorConversationId: string;
  conversationId: string;
  responseCode: string;
  responseDescription: string;
};

export async function submitB2CPayment(input: {
  phone: string;
  amount: number;
  remarks: string;
  occasion: string;
}): Promise<B2CPaymentResponse> {
  const resultUrl = getB2CResultUrl();
  const queueTimeoutUrl = getB2CQueueTimeoutUrl();
  if (!resultUrl || !queueTimeoutUrl) {
    throw new Error(
      'M-Pesa B2C callback URLs are not configured. Set MPESA_B2C_RESULT_URL and MPESA_B2C_QUEUE_TIMEOUT_URL (or NEXT_PUBLIC_APP_URL).',
    );
  }

  const { shortcode, initiatorName, securityCredential } = getDarajaCredentials();
  const token = await getDarajaAccessToken();
  const amount = Math.floor(input.amount);
  if (amount < 1) {
    throw new Error('B2C amount must be at least 1 KES');
  }

  const body = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: process.env.MPESA_B2C_COMMAND_ID?.trim() || 'SalaryPayment',
    Amount: String(amount),
    PartyA: shortcode,
    PartyB: input.phone,
    Remarks: input.remarks.slice(0, 100),
    QueueTimeOutURL: queueTimeoutUrl,
    ResultURL: resultUrl,
    Occasion: input.occasion.slice(0, 100),
  };

  const res = await fetch(`${getDarajaBaseUrl()}/mpesa/b2c/v1/paymentrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) {
    throw new Error(data.errorMessage || data.error || `B2C request failed (${res.status})`);
  }

  const responseCode = data.ResponseCode ?? '';
  const responseDescription = data.ResponseDescription ?? 'Unknown response';
  if (responseCode !== '0') {
    throw new Error(responseDescription || `B2C rejected (code ${responseCode})`);
  }

  return {
    originatorConversationId: data.OriginatorConversationID ?? '',
    conversationId: data.ConversationID ?? '',
    responseCode,
    responseDescription,
  };
}

/** Parse Safaricom B2C result callback payload (Result or nested Result). */
export function parseB2CCallbackPayload(body: unknown): {
  originatorConversationId: string;
  conversationId: string;
  resultCode: number;
  resultDesc: string;
  transactionId: string | null;
} | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const result = (root.Result ?? root.result) as Record<string, unknown> | undefined;
  if (!result || typeof result !== 'object') return null;

  const resultCode = Number(result.ResultCode ?? result.resultCode ?? -1);
  const resultDesc = String(result.ResultDesc ?? result.resultDesc ?? '');
  const originatorConversationId = String(
    result.OriginatorConversationID ?? result.originatorConversationID ?? '',
  );
  const conversationId = String(result.ConversationID ?? result.conversationID ?? '');

  let transactionId: string | null = null;
  const params = result.ResultParameters as
    | { ResultParameter?: Array<{ Key?: string; Value?: string | number }> }
    | undefined;
  const items = params?.ResultParameter;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.Key === 'TransactionReceipt' || item.Key === 'TransactionID') {
        transactionId = String(item.Value ?? '');
        break;
      }
    }
  }
  if (!transactionId && typeof result.TransactionID === 'string') {
    transactionId = result.TransactionID;
  }

  if (!originatorConversationId) return null;

  return {
    originatorConversationId,
    conversationId,
    resultCode,
    resultDesc,
    transactionId,
  };
}

export function resetDarajaTokenCacheForTests() {
  tokenCache = null;
}
