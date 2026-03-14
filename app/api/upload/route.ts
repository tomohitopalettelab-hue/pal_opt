import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, isExpired, MAIN_SESSION_COOKIE_NAME } from '@/lib/auth-session';

const PAL_DB_BASE = process.env.PAL_DB_BASE_URL || 'http://localhost:3100';

// Vercel Pro allows up to 300s; default hobby is 10s
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const raw = cookieStore.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = raw ? parseSessionValue(raw) : null;
    if (!session || isExpired(session)) {
      return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
    }

    const formData = await req.formData();
    if (!formData.has('paletteId')) {
      formData.append('paletteId', session.customerId || '');
    }

    // Proxy to pal_db with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    let res: Response;
    try {
      res = await fetch(`${PAL_DB_BASE}/api/media/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[upload] pal_db fetch error:', msg);
      return NextResponse.json(
        { error: `pal_db への接続に失敗しました。(${msg})` },
        { status: 502 },
      );
    }
    clearTimeout(timer);

    // pal_db always returns JSON
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      console.error('[upload] pal_db non-JSON response:', text.slice(0, 200));
      return NextResponse.json({ error: `pal_db から不正なレスポンスが返りました。` }, { status: 502 });
    }

    if (!res.ok) {
      const errMsg = typeof data.error === 'string' ? data.error : 'Upload failed';
      console.error('[upload] pal_db error:', errMsg);
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    // pal_db returns { success: true, asset: { url, ... } }
    const url = (data.asset as Record<string, unknown>)?.url ?? data.url;
    if (!url) {
      console.error('[upload] pal_db response missing url:', JSON.stringify(data));
      return NextResponse.json({ error: 'レスポンスに URL が含まれていません。' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upload] unexpected error:', message);
    return NextResponse.json({ error: `予期しないエラー: ${message}` }, { status: 500 });
  }
}
