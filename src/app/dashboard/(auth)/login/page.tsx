import { Suspense } from 'react';
import { getLoginPublicConfig } from '@/lib/login-public-config';
import { getLoginWelcomeCopy } from '@/lib/get-login-welcome-copy';
import { StaffLoginWithSearchParams } from './StaffLoginPageClient';

function LoginFallback() {
 return (
 <div className="flex min-h-screen items-center justify-center bg-[var(--sc-ink)]">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--sc-coral)]" />
 </div>
 );
}

export default async function StaffLoginPage() {
 const loginConfig = getLoginPublicConfig();
 const welcomeCopy = await getLoginWelcomeCopy();

 return (
 <Suspense fallback={<LoginFallback />}>
 <StaffLoginWithSearchParams loginConfig={loginConfig} welcomeCopy={welcomeCopy.staff} />
 </Suspense>
 );
}
