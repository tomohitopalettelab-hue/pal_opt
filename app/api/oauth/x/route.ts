import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID, randomBytes, createHash } from 'crypto';

// GET /api/oauth/x?paletteId={id}
// X (Twitter) OAuth 2.0 with PKCE フロー開始 → Xの認可画面へリダイレクト
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.X_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const callbackUrl = `${appUrl}/api/oauth/x/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'X_CLIENT_ID が設定されていません。' },
      { status: 500 }
    );
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  // CSRF防止用 state
  const state = randomUUID();

  // PKCE: code_verifier (43-128文字のランダム文字列) と code_challenge (SHA256 + base64url)
  const codeVerifier = randomBytes(32).toString('base64url'); // 43文字
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // Cookie に保存
  const cookieStore = await cookies();
  cookieStore.set('x_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('x_code_verifier', codeVerifier, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('x_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(url.toString());
}
