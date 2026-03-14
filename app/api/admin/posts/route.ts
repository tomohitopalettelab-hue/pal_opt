import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { getPostsByPaletteId } from '../../_lib/pal-opt-store';

export async function GET(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);

    if (!session || session.role !== 'admin' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const url = new URL(req.url);
    const paletteId = url.searchParams.get('paletteId') || '';
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です。' }, { status: 400 });
    }

    const posts = await getPostsByPaletteId(paletteId, 20);
    return NextResponse.json({ success: true, posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '投稿一覧の取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
