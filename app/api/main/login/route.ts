import { NextResponse } from 'next/server';
import { createSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, type SessionPayload } from '../../../../lib/auth-session';
import { palDbPost } from '../../_lib/pal-db-client';
import { canLoginPalOptByPaletteId } from '../../_lib/pal-opt-accounts';

type LoginBody = {
  id?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const id = String(body?.id || '').trim();
    const password = String(body?.password || '');

    if (!id || !password) {
      return NextResponse.json({ success: false, error: 'IDとパスワードを入力してください。' }, { status: 400 });
    }

    const verifyRes = await palDbPost('/api/verify-chat-login', { id, password });
    const verifyBody = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyBody?.success) {
      return NextResponse.json({ success: false, error: verifyBody?.error || 'ログイン情報が違います。' }, { status: 401 });
    }

    const paletteId = String(verifyBody?.paletteId || '').trim();
    const accountName = String(verifyBody?.accountName || '').trim();
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'ログイン情報の取得に失敗しました。' }, { status: 500 });
    }

    const canLogin = await canLoginPalOptByPaletteId(paletteId);
    if (!canLogin) {
      return NextResponse.json(
        { success: false, error: 'Pal Opt のご契約が必要です。' },
        { status: 403 },
      );
    }

    const session: SessionPayload = {
      role: 'customer',
      customerId: paletteId,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    };

    const res = NextResponse.json({ success: true, paletteId, accountName });
    res.cookies.set({
      name: MAIN_SESSION_COOKIE_NAME,
      value: createSessionValue(session),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return res;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'pal_db への接続がタイムアウトしました。' }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : 'ログインに失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
