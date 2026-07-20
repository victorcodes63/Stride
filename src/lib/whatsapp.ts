/**
 * WhatsApp delivery provider abstraction.
 *
 * Mirrors the graceful, provider-abstracted pattern in `email.ts`:
 * - Two optional providers selected by env (Meta WhatsApp Cloud API preferred, Twilio fallback).
 * - When nothing is configured, `sendWhatsApp` is a safe no-op that returns a typed result.
 * - Network/provider errors are caught and returned — this module never throws.
 *
 * No SDKs are used; both providers are called directly over `fetch` (Node runtime).
 */

const META_API_VERSION_DEFAULT = 'v21.0';

export type WhatsAppSendResult =
  | { sent: true; provider: 'meta' | 'twilio'; messageId?: string }
  | { sent: false; reason: 'not_configured' | 'error'; error: string };

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function metaConfig(): { phoneNumberId: string; accessToken: string; version: string } | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) return null;
  const version = process.env.WHATSAPP_API_VERSION?.trim() || META_API_VERSION_DEFAULT;
  return { phoneNumberId, accessToken, version };
}

function twilioConfig(): { accountSid: string; authToken: string; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/** Which provider will be used for the next send, or null when unconfigured. */
export function whatsAppProvider(): 'meta' | 'twilio' | null {
  if (metaConfig()) return 'meta';
  if (twilioConfig()) return 'twilio';
  return null;
}

export function isWhatsAppConfigured(): boolean {
  return whatsAppProvider() !== null;
}

/**
 * Best-effort E.164 normalization. Kept intentionally simple — it is not a full
 * libphonenumber implementation, only enough to make on-file numbers dialable.
 *
 * Rules:
 *  - Strip spaces, dashes, parentheses and dots.
 *  - Already `+CC...` → keep as-is (digits only after the plus).
 *  - Leading `0` for the default country (KE) → replace with the KE code `+254`.
 *  - Leading country code without `+` (e.g. `254...`) → prefix with `+`.
 *  - Otherwise not plausibly a phone number → return null.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountry = 'KE',
): string | null {
  if (!raw) return null;
  // Remove everything except digits and a possible leading plus.
  const cleaned = raw.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) return null;

  // Already in +CC format.
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digitsOnly = cleaned.replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (defaultCountry === 'KE') {
    // Local format: 07XXXXXXXX / 01XXXXXXXX → +2547XXXXXXXX / +2541XXXXXXXX.
    if (digitsOnly.startsWith('0')) {
      const rest = digitsOnly.slice(1);
      if (rest.length < 8) return null;
      return `+254${rest}`;
    }
    // Country code without plus: 2547XXXXXXXX.
    if (digitsOnly.startsWith('254')) {
      if (digitsOnly.length < 11 || digitsOnly.length > 12) return null;
      return `+${digitsOnly}`;
    }
    // Bare subscriber number starting with 7/1 (e.g. 7XXXXXXXX).
    if (/^[17]\d{8}$/.test(digitsOnly)) {
      return `+254${digitsOnly}`;
    }
  }

  // Generic fallback: a plausible international number already carrying its code.
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
  }

  return null;
}

async function sendViaMeta(
  cfg: { phoneNumberId: string; accessToken: string; version: string },
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  try {
    const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        // Meta expects the number without the leading '+'.
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

    if (!res.ok) {
      const message = data?.error?.message || `Meta WhatsApp API returned ${res.status}`;
      return { sent: false, reason: 'error', error: message };
    }
    return { sent: true, provider: 'meta', messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { sent: false, reason: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaTwilio(
  cfg: { accountSid: string; authToken: string; from: string },
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const form = new URLSearchParams({
      From: cfg.from,
      To: `whatsapp:${to}`,
      Body: body,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => null)) as
      | { sid?: string; message?: string; error_message?: string }
      | null;

    if (!res.ok) {
      const message = data?.message || data?.error_message || `Twilio API returned ${res.status}`;
      return { sent: false, reason: 'error', error: message };
    }
    return { sent: true, provider: 'twilio', messageId: data?.sid };
  } catch (err) {
    return { sent: false, reason: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a plain-text WhatsApp message. Resolves the provider from env at call time.
 * Graceful no-op when no provider is configured.
 */
export async function sendWhatsApp(params: { to: string; body: string }): Promise<WhatsAppSendResult> {
  const { to, body } = params;

  const meta = metaConfig();
  if (meta) return sendViaMeta(meta, to, body);

  const twilio = twilioConfig();
  if (twilio) return sendViaTwilio(twilio, to, body);

  // No provider configured — safe no-op. Log the intended send only in dev.
  if (!isProd()) {
    console.log('[whatsapp] not configured — would send:', { to, body });
  }
  return {
    sent: false,
    reason: 'not_configured',
    error: 'WhatsApp provider not configured',
  };
}
