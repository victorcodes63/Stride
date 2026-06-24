import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  pastDueReadOnlyPayload,
  shouldBlockMutationForAccount,
} from '@/lib/account-readonly';
import { isAccountGateExempt } from '@/lib/account-access-middleware';

export function enforcePastDueReadOnly(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (isAccountGateExempt(pathname)) return null;
  if (!pathname.startsWith('/api/')) return null;

  if (!shouldBlockMutationForAccount(request, request.method)) return null;

  return NextResponse.json(pastDueReadOnlyPayload(), { status: 403 });
}
