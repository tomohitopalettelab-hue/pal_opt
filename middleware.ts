import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, parseSessionValue, isExpired } from '@/lib/auth-session';

/**
 * 顧客向け画面(/main)と顧客API(/api/app)をセッションで保護。
 * それ以外(/login, /api/auth/*)は素通し。APIはdefault-denyの方針で
 * 保護対象パス以下に置くこと。
 */
export async function middleware(req: NextRequest) {
  const payload = await parseSessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload || isExpired(payload)) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
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
  matcher: ['/main/:path*', '/api/app/:path*'],
};
