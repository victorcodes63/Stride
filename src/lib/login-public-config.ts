import { getDemoLoginEmailPlaceholder } from '@/lib/demo-credentials';
import { isGenericPublicLogin } from '@/lib/marketing-site';

/** Public login UI config — read on the server and passed as props to avoid hydration mismatches. */
export type LoginPublicConfig = {
  emailPlaceholder: string;
};

export function getLoginPublicConfig(): LoginPublicConfig {
  const generic = isGenericPublicLogin();

  return {
    emailPlaceholder: generic ? 'you@company.co.ke' : getDemoLoginEmailPlaceholder(),
  };
}
