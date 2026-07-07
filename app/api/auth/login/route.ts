import { NextResponse } from 'next/server';
import { createSessionValue, SESSION_COOKIE, SESSION_TTL_MS, type SessionPayload } from '@/lib/auth-session';
import { palDbPost } from '@/lib/pal-db-client';
import { hasPalOptContract } from '@/lib/services';

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

    // 顧客認証は pal_db proxy に委譲（accounts.chat_login_id + scrypt照合・active のみ）
    const verifyRes = await palDbPost('/api/verify-chat-login', { id, password });
    const verifyBody = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyBody?.success) {
      return NextResponse.json({ success: false, error: verifyBody?.error || 'ログイン情報が違います。' }, { status: 401 });
    }

    const paletteId = String(verifyBody?.paletteId || '').trim().toUpperCase();
    const accountName = String(verifyBody?.accountName || '').trim();
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'ログイン情報の取得に失敗しました。' }, { status: 500 });
    }

    const canLogin = await hasPalOptContract(paletteId);
    if (!canLogin) {
      return NextResponse.json({ success: false, error: 'Pal Opt のご契約が必要です。' }, { status: 403 });
    }

    const session: SessionPayload = {
      role: 'customer',
      paletteId,
      accountName: accountName || undefined,
      exp: Date.now() + SESSION_TTL_MS,
    };

    const res = NextResponse.json({ success: true, paletteId, accountName });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: await createSessionValue(session),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
    return res;
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'pal_db への接続がタイムアウトしました。' }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : 'ログインに失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
