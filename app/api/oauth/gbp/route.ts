import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/session-server';
import { GOOGLE_SCOPES, oauthRedirectUri } from '@/lib/google';

/**
 * Google連携（GBP+GSC）のOAuth開始。旧pal_optと同じパス/リダイレクトURIを使用。
 * paletteIdはクエリでなくセッションから取得（なりすまし防止）。
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104'));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'GOOGLE_CLIENT_ID が設定されていません。' }, { status: 500 });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', oauthRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
