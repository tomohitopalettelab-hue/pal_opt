import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, parseSessionValue, isExpired } from '@/lib/auth-session';
import { ADMIN_COOKIE, parseAdminValue, isAdminExpired } from '@/lib/admin-session';

/**
 * 顧客向け(/main, /api/app)と管理者向け(/admin, /api/admin)をそれぞれのセッションで保護。
 * /login, /api/auth/*, /admin/login, /api/admin/login は素通し。
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next();
    const admin = await parseAdminValue(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!admin || isAdminExpired(admin)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: '管理者認証が必要です。' }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const payload = await parseSessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload || isExpired(payload)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/main/:path*', '/api/app/:path*', '/admin/:path*', '/api/admin/:path*'],
};
