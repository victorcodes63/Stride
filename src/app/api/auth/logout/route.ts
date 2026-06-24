import { NextRequest, NextResponse } from 'next/server';

const STAFF_SESSION_COOKIE = 'staff_session';

function getCookieDomain(requestUrl: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const host = new URL(requestUrl).hostname.toLowerCase();
  if (host === 'example.com' || host === 'www.example.com') return '.example.com';
  return undefined;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const cookieDomain = getCookieDomain(request.url);
  response.cookies.set(STAFF_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  });
  return response;
}
