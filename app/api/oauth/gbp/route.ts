import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// GET /api/oauth/gbp?paletteId={id}
// Google Business Profile OAuth フロー開始 → Googleの認可画面へリダイレクト
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectUri = `${appUrl}/api/oauth/gbp/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID が設定されていません。' },
      { status: 500 }
    );
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  // CSRF防止用 state を Cookie に保存
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('gbp_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('gbp_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/business.manage');
  url.searchParams.set('access_type', 'offline');   // refresh_token を取得するために必須
  url.searchParams.set('prompt', 'consent');          // 毎回 refresh_token を発行させる
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
