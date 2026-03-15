import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// GET /api/oauth/instagram?paletteId={id}
// Instagram OAuth フロー開始 → Facebookの認可画面へリダイレクト
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const appId = process.env.FACEBOOK_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

  if (!appId) {
    return NextResponse.json(
      { error: 'FACEBOOK_APP_ID が設定されていません。' },
      { status: 500 }
    );
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  // CSRF防止用 state を Cookie に保存
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('ig_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('ig_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const scope = [
    'pages_show_list',
    'instagram_basic',
    'instagram_content_publish',
    'pages_read_engagement',
  ].join(',');

  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  return NextResponse.redirect(url.toString());
}
