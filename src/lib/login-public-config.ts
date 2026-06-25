import { getDemoLoginEmailPlaceholder } from '@/lib/demo-credentials';
import { isInternalDemoSandboxAdvertised } from '@/lib/demo-access';
import { isGenericPublicLogin } from '@/lib/marketing-site';

/** Public login UI config — read on the server and passed as props to avoid hydration mismatches. */
export type LoginPublicConfig = {
  emailPlaceholder: string;
};

const GENERIC_LOGIN_PLACEHOLDER = 'you@company.co.ke';

export function getLoginPublicConfig(): LoginPublicConfig {
  const showDemoPlaceholder =
    isInternalDemoSandboxAdvertised() && !isGenericPublicLogin();

  return {
    emailPlaceholder: showDemoPlaceholder
      ? getDemoLoginEmailPlaceholder()
      : GENERIC_LOGIN_PLACEHOLDER,
  };
}
