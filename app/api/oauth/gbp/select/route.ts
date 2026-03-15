import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-opt-store';

// POST /api/oauth/gbp/select
// 複数ロケーションから1つを選択して保存する
export async function POST(req: Request) {
  try {
    const { locationId, locationName, paletteId } = await req.json();
    if (!locationId || !paletteId) {
      return NextResponse.json({ success: false, error: 'locationId と paletteId が必要です。' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('gbp_token_temp')?.value;
    const refreshToken = cookieStore.get('gbp_refresh_temp')?.value || '';

    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'セッションが期限切れです。再度OAuth連携してください。' }, { status: 400 });
    }

    await upsertSettings(paletteId, {
      gbpAccessToken: accessToken,
      gbpRefreshToken: refreshToken,
      gbpLocationId: locationId,
    });

    cookieStore.delete('gbp_token_temp');
    cookieStore.delete('gbp_refresh_temp');
    cookieStore.delete('gbp_pid_temp');

    return NextResponse.json({ success: true, locationName });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '保存に失敗しました。' }, { status: 500 });
  }
}
