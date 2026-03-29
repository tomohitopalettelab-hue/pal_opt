import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-opt-store';

// GET /api/oauth/x/callback?code={code}&state={state}
// X (Twitter) からのリダイレクト受け取り → トークン取得・保存
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectBase = `${appUrl}/admin`;

  // X がエラーを返した場合
  if (error || !code) {
    const msg = encodeURIComponent(error || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?x_error=${msg}`);
  }

  // CSRF state 検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;
  const paletteId = cookieStore.get('x_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?x_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  if (!codeVerifier) {
    return NextResponse.redirect(`${redirectBase}?x_error=${encodeURIComponent('PKCE検証に失敗しました（code_verifierが見つかりません）。')}`);
  }

  // Cookie クリア
  cookieStore.delete('x_oauth_state');
  cookieStore.delete('x_code_verifier');
  cookieStore.delete('x_palette_id');

  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const callbackUrl = `${appUrl}/api/oauth/x/callback`;

  try {
    // アクセストークン取得
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'アクセストークンの取得に失敗しました。');
    }

    // 設定に保存
    await upsertSettings(paletteId, {
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token || null,
    });

    return NextResponse.redirect(
      `${redirectBase}?x_connected=1&paletteId=${encodeURIComponent(paletteId)}`
    );
  } catch (err: any) {
    const msg = encodeURIComponent(err?.message || 'X連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?x_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
