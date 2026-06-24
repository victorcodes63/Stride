import { Suspense } from 'react';
import { getLoginPublicConfig } from '@/lib/login-public-config';
import { getLoginWelcomeCopy } from '@/lib/get-login-welcome-copy';
import { EssLoginForm } from './EssLoginPageClient';

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-pub">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-pub-border border-t-pub-primary" />
    </div>
  );
}

export default async function EssLoginPage() {
  const loginConfig = getLoginPublicConfig();
  const welcomeCopy = await getLoginWelcomeCopy();

  return (
    <Suspense fallback={<LoginFallback />}>
      <EssLoginForm loginConfig={loginConfig} welcomeCopy={welcomeCopy.ess} />
    </Suspense>
  );
}
