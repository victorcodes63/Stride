import {
  DEMO_ADMIN_EMAIL,
  DEMO_ESS_EMAIL,
  DEMO_FINANCE_EMAIL,
  DEMO_HR_EMAIL,
} from '@/lib/demo-credentials';
import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-config';
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
 * Unlisted demo sandbox page — opt in via NEXT_PUBLIC_DEMO_ACCESS_PAGE or demo deploys
 * that are not using generic public login (no tenant emails on /dashboard/login).
 */
export function isDemoAccessPageEnabled(): boolean {
  if (parseBoolean(trimEnv('NEXT_PUBLIC_DEMO_ACCESS_PAGE'), false)) return true;
  if (isPublicDemoMode() || isDemoMode()) {
    return !isGenericPublicLogin();
  }
  return false;
}

/** Role / email rows for the demo-access page (password is never included). */
export function getDemoAccessRows(): DemoAccessRow[] {
  return [
    { role: 'Admin', email: DEMO_ADMIN_EMAIL },
    { role: 'HR', email: DEMO_HR_EMAIL },
    { role: 'Finance', email: DEMO_FINANCE_EMAIL },
    { role: 'ESS', email: DEMO_ESS_EMAIL, note: 'Employee portal — sign in at /ess/login' },
  ];
}
