import {
  DEMO_ADMIN_EMAIL,
  DEMO_ESS_EMAIL,
  DEMO_FINANCE_EMAIL,
  DEMO_HR_EMAIL,
} from '@/lib/demo-credentials';
import { isGenericPublicLogin } from '@/lib/marketing-site';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

export type DemoAccessRow = { role: string; email: string; note?: string };

/**
 * RAV-169: demo sandbox must never be advertised on public marketing or product login surfaces.
 * Opt in only for local/staging via NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX (never production).
 */
export function isInternalDemoSandboxAdvertised(): boolean {
  return parseBoolean(trimEnv('NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX'), false);
}

/** @deprecated Use {@link isInternalDemoSandboxAdvertised} — kept for call sites. */
export function isPublicDemoSandboxAdvertised(): boolean {
  return isInternalDemoSandboxAdvertised();
}

/**
 * Unlisted /demo-access page — internal tooling only (RAV-169).
 * Disabled on all public deploys (marketing domain, generic login, default app).
 */
export function isDemoAccessPageEnabled(): boolean {
  if (!isInternalDemoSandboxAdvertised()) return false;
  if (trimEnv('NEXT_PUBLIC_MARKETING_DOMAIN')) return false;
  if (isGenericPublicLogin()) return false;
  return true;
}

/** Role / email rows for the internal-only demo-access page (password never included). */
export function getDemoAccessRows(): DemoAccessRow[] {
  return [
    { role: 'Admin', email: DEMO_ADMIN_EMAIL },
    { role: 'HR', email: DEMO_HR_EMAIL },
    { role: 'Finance', email: DEMO_FINANCE_EMAIL },
    { role: 'ESS', email: DEMO_ESS_EMAIL, note: 'Employee portal — sign in at /ess/login' },
  ];
}
