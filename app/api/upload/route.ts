import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, isExpired, MAIN_SESSION_COOKIE_NAME } from '@/lib/auth-session';

const PAL_DB_BASE = process.env.PAL_DB_BASE_URL || 'http://localhost:3100';

export async function POST(req: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const raw = cookieStore.get(MAIN_SESSION_COOKIE_NAME)?.value;
  const session = raw ? parseSessionValue(raw) : null;
  if (!session || isExpired(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    // Ensure paletteId is set
    if (!formData.has('paletteId')) {
      formData.append('paletteId', session.customerId || '');
    }

    const res = await fetch(`${PAL_DB_BASE}/api/media/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Upload failed' }, { status: res.status });
    }

    // pal_db returns { success, asset: { url, ... } }
    const url = data.asset?.url || data.url;
    if (!url) {
      return NextResponse.json({ error: 'No URL in response' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
