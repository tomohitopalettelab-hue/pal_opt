import { NextResponse } from 'next/server';
import { getSettingsByPaletteId, upsertSettings } from '../../../_lib/pal-opt-store';

// POST /api/oauth/gbp/refresh
// GBPアクセストークンをリフレッシュトークンで更新する
// body: { paletteId: string }
export async function POST(req: Request) {
  try {
    const { paletteId } = await req.json();
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です。' }, { status: 400 });
    }

    const settings = await getSettingsByPaletteId(paletteId);
    if (!settings?.gbpRefreshToken) {
      return NextResponse.json({ success: false, error: 'リフレッシュトークンが保存されていません。再度OAuth連携してください。' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ success: false, error: 'Google OAuth設定が不足しています。' }, { status: 500 });
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.gbpRefreshToken,
      }).toString(),
    });

    const data = await res.json();
    if (!data.access_token) {
      throw new Error(data.error_description || 'トークンの更新に失敗しました。再度OAuth連携が必要な可能性があります。');
    }

    await upsertSettings(paletteId, { gbpAccessToken: data.access_token });

    return NextResponse.json({ success: true, accessToken: data.access_token });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'トークン更新に失敗しました。' }, { status: 500 });
  }
}
