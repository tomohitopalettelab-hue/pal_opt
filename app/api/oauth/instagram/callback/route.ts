import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-opt-store';

// GET /api/oauth/instagram/callback?code={code}&state={state}
// Facebook からのリダイレクト受け取り → トークン取得・アカウント情報保存
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const fbError = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectBase = `${appUrl}/admin`;

  // Facebookがエラーを返した場合
  if (fbError || !code) {
    const msg = encodeURIComponent(fbError || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?ig_error=${msg}`);
  }

  // CSRF state 検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get('ig_oauth_state')?.value;
  const paletteId = cookieStore.get('ig_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?ig_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  // Cookie クリア
  cookieStore.delete('ig_oauth_state');
  cookieStore.delete('ig_oauth_palette_id');

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

  try {
    // ① 短命アクセストークン取得
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString()
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'アクセストークンの取得に失敗しました。');
    }
    const shortToken: string = tokenData.access_token;

    // ② 長命トークン（60日有効）に交換
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        }).toString()
    );
    const longTokenData = await longTokenRes.json();
    const longToken: string = longTokenData.access_token || shortToken;

    // ③ Facebookページ一覧とInstagramビジネスアカウントを取得
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?` +
        new URLSearchParams({
          fields: 'id,name,instagram_business_account{id,name,username}',
          access_token: longToken,
        }).toString()
    );
    const pagesData = await pagesRes.json();
    const pages: any[] = pagesData.data || [];

    // Instagramビジネスアカウントが紐づいているページを抽出
    const igAccounts = pages
      .filter((p) => p.instagram_business_account?.id)
      .map((p) => ({
        pageId: p.id,
        pageName: p.name,
        igId: p.instagram_business_account.id,
        igName: p.instagram_business_account.username || p.instagram_business_account.name,
      }));

    if (igAccounts.length === 0) {
      // デバッグ：どのページが取得できているか表示
      const pageNames = pages.map((p) => `${p.name}(id:${p.id}, ig:${p.instagram_business_account ? '✓' : '✗'})`).join(' / ');
      throw new Error(
        `Instagramビジネスアカウントが見つかりません。取得したFBページ: [${pageNames || 'ページなし'}] ` +
          '— FacebookページにInstagramプロアカウントを連携してください。'
      );
    }

    // 複数ある場合は選択画面へ（base64エンコードしてクエリパラメータで渡す）
    if (igAccounts.length > 1) {
      // トークンだけ一時Cookieに保存して選択させる
      cookieStore.set('ig_token_temp', longToken, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' });
      cookieStore.set('ig_pid_temp', paletteId, { httpOnly: true, maxAge: 300, path: '/', sameSite: 'lax' });
      const encoded = Buffer.from(JSON.stringify(igAccounts)).toString('base64url');
      return NextResponse.redirect(
        `${redirectBase}?ig_select=1&paletteId=${encodeURIComponent(paletteId)}&accounts=${encoded}`
      );
    }

    // 1件のみ → そのまま保存
    const account = igAccounts[0];
    await upsertSettings(paletteId, {
      igAccessToken: longToken,
      igBusinessAccountId: account.igId,
    });

    return NextResponse.redirect(
      `${redirectBase}?ig_connected=1&paletteId=${encodeURIComponent(paletteId)}&ig_user=${encodeURIComponent(account.igName)}`
    );
  } catch (err: any) {
    const msg = encodeURIComponent(err?.message || 'Instagram連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?ig_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
