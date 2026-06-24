/**
 * Demo login hints — configure per deployment to match seeded accounts.
 * Set NEXT_PUBLIC_DEMO_* in env (see .env.example).
 */

function trimEnvValue(v: string | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

const DEMO_PASSWORD =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_PASSWORD) ?? 'Demo@2026!';

const DEMO_ADMIN_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL) ?? 'admin@imara.co.ke';

const DEMO_HR_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_HR_EMAIL) ?? 'hr@heritage.imara.co.ke';

const DEMO_APPROVER_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_APPROVER_EMAIL) ?? DEMO_HR_EMAIL;

const DEMO_STAFF_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL) ?? 'james.otieno@eaglehr.co.ke';

const DEMO_FINANCE_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_FINANCE_EMAIL) ?? 'finance@heritage.imara.co.ke';

const DEMO_ESS_EMAIL =
  trimEnvValue(process.env.NEXT_PUBLIC_DEMO_ESS_EMAIL) ?? 'employee@heritage.imara.co.ke';

export function getDemoPassword(): string {
  return DEMO_PASSWORD;
}

export type DemoCredentialRow = { role: string; email: string };

/** Dashboard access levels for the sign-in info panel. */
export function getStaffDemoCredentialRows(): DemoCredentialRow[] {
  const rows: DemoCredentialRow[] = [
    { role: 'Administrator', email: DEMO_ADMIN_EMAIL },
    { role: 'Leave approver', email: DEMO_APPROVER_EMAIL },
    { role: 'Staff member', email: DEMO_STAFF_EMAIL },
    { role: 'Finance', email: DEMO_FINANCE_EMAIL },
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getEssDemoCredentialRow(): DemoCredentialRow {
  return {
    role: 'Employee portal',
    email: DEMO_ESS_EMAIL,
  };
}

export function getDemoLoginEmailPlaceholder(): string {
  return DEMO_ADMIN_EMAIL;
}
