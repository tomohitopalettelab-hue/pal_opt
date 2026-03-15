import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, isExpired, MAIN_SESSION_COOKIE_NAME } from '@/lib/auth-session';

const PAL_DB_BASE = process.env.PAL_DB_BASE_URL || 'http://localhost:3100';

// Vercel Pro は最大300秒、hobby プランはデフォルト10秒
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const cookieStore = await cookies();
    const raw = cookieStore.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = raw ? parseSessionValue(raw) : null;
    if (!session || isExpired(session)) {
      return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
    }

    const incomingForm = await req.formData();
    // pal_db は大文字の A0001 形式を要求する
    const paletteId = String(session.customerId || '').trim().toUpperCase();

    // multer の diskStorage.destination はマルチパートストリームの途中で実行されるため、
    // paletteId フィールドは file より先に送信しなければならない。
    const fileEntry = incomingForm.get('file');
    if (!fileEntry) {
      return NextResponse.json({ error: 'ファイルが見つかりません。' }, { status: 400 });
    }
    const forwardForm = new FormData();
    forwardForm.append('paletteId', paletteId);
    forwardForm.append('file', fileEntry as Blob, (fileEntry as File).name ?? 'upload');

    // pal_db へプロキシ（タイムアウト付き）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    let res: Response;
    try {
      res = await fetch(`${PAL_DB_BASE}/api/media/upload`, {
        method: 'POST',
        body: forwardForm,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[upload] pal_db 接続エラー:', msg);
      return NextResponse.json(
        { error: `pal_db への接続に失敗しました。(${msg})` },
        { status: 502 },
      );
    }
    clearTimeout(timer);

    // pal_db は常に JSON を返す
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      console.error('[upload] pal_db 非JSONレスポンス:', text.slice(0, 200));
      return NextResponse.json({ error: `pal_db から不正なレスポンスが返りました。` }, { status: 502 });
    }

    if (!res.ok) {
      const errMsg = typeof data.error === 'string' ? data.error : 'アップロードに失敗しました。';
      console.error('[upload] pal_db エラー:', errMsg);
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    // pal_db は { success: true, asset: { url, ... } } を返す
    const url = (data.asset as Record<string, unknown>)?.url ?? data.url;
    if (!url) {
      console.error('[upload] pal_db レスポンスに url がありません:', JSON.stringify(data));
      return NextResponse.json({ error: 'レスポンスに URL が含まれていません。' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upload] 予期しないエラー:', message);
    return NextResponse.json({ error: `予期しないエラー: ${message}` }, { status: 500 });
  }
}
