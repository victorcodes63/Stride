'use client';

import { CalendarCheck, ChartLineUp, LockKey, UsersThree } from '@phosphor-icons/react';
import type { OAuthAudience } from '@/lib/oauth-utils';
import { PubFeatureCallout } from '@/components/public/PubDuotoneIcon';

const STAFF_FEATURES = [
  {
    icon: UsersThree,
    title: 'People operations',
    description: 'Employees, leave, payroll, and recruitment in one workspace.',
  },
  {
    icon: ChartLineUp,
    title: 'Reporting & compliance',
    description: 'Audit trails, approvals, and exports built for HR teams.',
  },
  {
    icon: LockKey,
    title: 'Secure access',
    description: 'Role-based permissions with optional SSO and MFA.',
  },
] as const;

const ESS_FEATURES = [
  {
    icon: UsersThree,
    title: 'Self-service',
    description: 'Leave, payslips, attendance, and profile updates.',
  },
  {
    icon: CalendarCheck,
    title: 'Requests & approvals',
    description: 'Submit leave and track status without contacting HR.',
  },
  {
    icon: LockKey,
    title: 'Secure access',
    description: 'Sign in with your work account or organisation SSO.',
  },
] as const;

type LoginBrandFeaturesProps = {
  audience: OAuthAudience;
};

export function LoginBrandFeatures({ audience }: LoginBrandFeaturesProps) {
  const items = audience === 'ess' ? ESS_FEATURES : STAFF_FEATURES;

  return (
    <ul className="relative z-10 mt-10 space-y-6 lg:mt-12">
      {items.map((item) => (
        <li key={item.title}>
          <PubFeatureCallout icon={item.icon} title={item.title} description={item.description} />
        </li>
      ))}
    </ul>
  );
}
