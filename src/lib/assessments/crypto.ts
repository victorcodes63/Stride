import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for per-tenant provider credentials (Phase 4 decision).
 * Secrets are never stored in plaintext; the key comes from CREDENTIALS_ENC_KEY.
 * Format: v1:<ivB64>:<tagB64>:<cipherB64>
 */
const VERSION = 'v1';

function encryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENC_KEY?.trim();
  if (!raw) {
    throw new CredentialCryptoError(
      'CREDENTIALS_ENC_KEY is not configured. Set a 32-byte secret to store provider credentials.',
    );
  }
  // Accept a raw 32-byte value, base64, or any passphrase (hashed to 32 bytes).
  if (raw.length === 32) return Buffer.from(raw, 'utf8');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through to hashing
  }
  return createHash('sha256').update(raw).digest();
}

export function credentialCryptoConfigured(): boolean {
  return Boolean(process.env.CREDENTIALS_ENC_KEY?.trim());
}

export function encryptCredentials(plain: Record<string, unknown>): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const json = Buffer.from(JSON.stringify(plain), 'utf8');
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptCredentials<T = Record<string, unknown>>(cipherText: string): T {
  const parts = cipherText.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new CredentialCryptoError('Malformed credential ciphertext.');
  }
  const key = encryptionKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialCryptoError';
  }
}
