/**
 * Normalize Kenyan mobile numbers to 254XXXXXXXXX for M-Pesa B2C.
 */
export function normalizeKenyanMsisdn(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  if (digits.length === 9) digits = `254${digits}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  return null;
}

export function formatMsisdnForDisplay(msisdn: string): string {
  if (msisdn.startsWith('254') && msisdn.length === 12) {
    return `+${msisdn.slice(0, 3)} ${msisdn.slice(3, 6)} ${msisdn.slice(6)}`;
  }
  return msisdn;
}
