import { NextResponse } from 'next/server';
import { createAdminValue, ADMIN_COOKIE, ADMIN_TTL_MS } from '@/lib/admin-session';

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const expectedUser = process.env.ADMIN_USERNAME || '';
  const expectedPass = process.env.ADMIN_PASSWORD || '';
  if (!expectedUser || !expectedPass) {
    return NextResponse.json({ success: false, error: '管理者認証が未設定です。' }, { status: 500 });
  }
  if (!safeEqual(String(body.username || ''), expectedUser) || !safeEqual(String(body.password || ''), expectedPass)) {
    return NextResponse.json({ success: false, error: 'IDまたはパスワードが違います。' }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: await createAdminValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_MS / 1000,
  });
  return res;
}
