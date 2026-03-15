import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-opt-store';

// POST /api/oauth/instagram/select
// 複数アカウントから1つを選択して保存する
export async function POST(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectBase = `${appUrl}/admin`;

  try {
    const { igId, igName, paletteId } = await req.json();
    if (!igId || !paletteId) {
      return NextResponse.json({ success: false, error: 'igId と paletteId が必要です。' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const longToken = cookieStore.get('ig_token_temp')?.value;
    if (!longToken) {
      return NextResponse.json({ success: false, error: 'セッションが期限切れです。再度OAuth連携してください。' }, { status: 400 });
    }

    await upsertSettings(paletteId, {
      igAccessToken: longToken,
      igBusinessAccountId: igId,
    });

    cookieStore.delete('ig_token_temp');
    cookieStore.delete('ig_pid_temp');

    return NextResponse.json({ success: true, igUser: igName });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '保存に失敗しました。' }, { status: 500 });
  }
}
