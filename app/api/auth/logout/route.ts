import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth-session';

const clearSession = (res: NextResponse): NextResponse => {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return clearSession(NextResponse.redirect(url));
}

export async function POST() {
  return clearSession(NextResponse.json({ success: true }));
}
