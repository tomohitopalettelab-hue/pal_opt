import { NextRequest, NextResponse } from 'next/server';
import { isExpired, parseSessionValue, SESSION_COOKIE_NAME } from './lib/auth-session';

const redirectToLogin = (req: NextRequest) => {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
};

export function proxy(req: NextRequest) {
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionValue(cookieValue);

  if (!session || isExpired(session)) {
    const res = redirectToLogin(req);
    res.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
    return res;
  }

  if (session.role !== 'admin') {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
