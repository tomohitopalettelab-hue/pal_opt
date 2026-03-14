import { NextResponse } from 'next/server';
import { createSessionValue, SESSION_COOKIE_NAME, type SessionPayload } from '../../../lib/auth-session';

type LoginBody = {
  role?: 'admin';
  id?: string;
  password?: string;
  next?: string;
};

const resolveNextPath = (next?: string, fallback: string = '/admin') => {
  if (!next) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//')) return fallback;
  return next;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const role = body.role;
    const id = String(body.id || '').trim();
    const password = String(body.password || '');

    if (role !== 'admin' || !id || !password) {
      return NextResponse.json({ success: false, error: 'IDとパスワードを入力してください。' }, { status: 400 });
    }

    const adminUser =
      process.env.ADMIN_USERNAME?.trim() ||
      process.env.ADMIN_USER?.trim() ||
      process.env.PLATFORM_ADMIN_USERNAME?.trim() ||
      'tomohito0108';
    const adminPass =
      process.env.ADMIN_PASSWORD?.trim() ||
      process.env.PLATFORM_ADMIN_PASSWORD?.trim() ||
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim();

    if (!adminUser || !adminPass) {
      return NextResponse.json(
        { success: false, error: '管理者ログイン設定が未構成です。ADMIN_PASSWORD を設定してください。' },
        { status: 500 },
      );
    }

    if (id !== adminUser || password !== adminPass) {
      return NextResponse.json({ success: false, error: 'IDまたはパスワードが違います。' }, { status: 401 });
    }

    const session: SessionPayload = {
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12,
    };

    const redirectTo = resolveNextPath(body.next, '/admin');
    const res = NextResponse.json({ success: true, redirectTo });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: createSessionValue(session),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ログインに失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
