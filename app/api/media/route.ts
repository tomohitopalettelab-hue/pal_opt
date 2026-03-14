import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, isExpired, MAIN_SESSION_COOKIE_NAME } from '@/lib/auth-session';

const PAL_DB_BASE = process.env.PAL_DB_BASE_URL || 'http://localhost:3100';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = raw ? parseSessionValue(raw) : null;
    if (!session || isExpired(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paletteId = String(session.customerId || '').trim().toUpperCase();
    if (!paletteId) {
      return NextResponse.json({ error: 'paletteId not found in session' }, { status: 400 });
    }

    const res = await fetch(
      `${PAL_DB_BASE}/api/media?paletteId=${encodeURIComponent(paletteId)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
