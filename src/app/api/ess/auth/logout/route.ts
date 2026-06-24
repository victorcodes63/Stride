import { NextRequest, NextResponse } from 'next/server';

const ESS_SESSION_COOKIE = 'ess_session';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ESS_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
