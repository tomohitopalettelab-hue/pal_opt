import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-opt-store';

// GET /api/oauth/gbp/callback?code={code}&state={state}
// Google からのリダイレクト受け取り → トークン取得・ロケーション取得・保存
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const googleError = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectBase = `${appUrl}/admin`;

  if (googleError || !code) {
    const msg = encodeURIComponent(googleError === 'access_denied' ? '認可がキャンセルされました。' : (googleError || '認可に失敗しました。'));
    return NextResponse.redirect(`${redirectBase}?gbp_error=${msg}`);
  }

  // CSRF state 検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get('gbp_oauth_state')?.value;
  const paletteId = cookieStore.get('gbp_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?gbp_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  cookieStore.delete('gbp_oauth_state');
  cookieStore.delete('gbp_oauth_palette_id');

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/gbp/callback`;

  try {
    // ① 認可コードをトークンに交換
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'アクセストークンの取得に失敗しました。');
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string = tokenData.refresh_token || '';

    // ② GBPアカウント一覧を取得
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json();
    console.log('[GBP Debug] accounts API status:', accountsRes.status, 'data:', JSON.stringify(accountsData));
    const accounts: any[] = accountsData.accounts || [];

    if (accounts.length === 0) {
      const detail = JSON.stringify(accountsData);
      throw new Error(`Google ビジネスプロフィールのアカウントが見つかりません。GBPに登録されているGoogleアカウントでログインしてください。[API ${accountsRes.status}: ${detail}]`);
    }

    // ③ 各アカウントのロケーション一覧を取得
    const locations: { id: string; name: string; address: string }[] = [];
    for (const account of accounts) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locData = await locRes.json();
      const locs: any[] = locData.locations || [];
      for (const loc of locs) {
        const addr = loc.storefrontAddress
          ? [loc.storefrontAddress.locality, loc.storefrontAddress.administrativeArea].filter(Boolean).join(', ')
          : '';
        locations.push({ id: loc.name, name: loc.title || loc.name, address: addr });
      }
    }

    if (locations.length === 0) {
      throw new Error('ロケーションが見つかりません。GBPに店舗情報を登録してください。');
    }

    // 1件のみ → そのまま保存
    if (locations.length === 1) {
      await upsertSettings(paletteId, {
        gbpAccessToken: accessToken,
        gbpRefreshToken: refreshToken,
        gbpLocationId: locations[0].id,
      });
      return NextResponse.redirect(
        `${redirectBase}?gbp_connected=1&paletteId=${encodeURIComponent(paletteId)}&gbp_name=${encodeURIComponent(locations[0].name)}`
      );
    }

    // 複数ある場合 → 選択画面へ
    cookieStore.set('gbp_token_temp', accessToken, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' });
    cookieStore.set('gbp_refresh_temp', refreshToken, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' });
    cookieStore.set('gbp_pid_temp', paletteId, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' });
    const encoded = Buffer.from(JSON.stringify(locations)).toString('base64url');
    return NextResponse.redirect(
      `${redirectBase}?gbp_select=1&paletteId=${encodeURIComponent(paletteId)}&locations=${encoded}`
    );
  } catch (err: any) {
    const msg = encodeURIComponent(err?.message || 'GBP連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?gbp_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
