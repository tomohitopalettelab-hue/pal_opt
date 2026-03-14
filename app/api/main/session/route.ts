import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { getPostsByPaletteId } from '../../_lib/pal-opt-store';

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const store = await cookies();
    const mainCookie = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const legacyCookie = store.get(SESSION_COOKIE_NAME)?.value;
    const fallbackValue = (() => {
      const parts = cookieHeader.split(';').map((part) => part.trim());
      const mainMatch = parts.find((part) => part.startsWith(`${MAIN_SESSION_COOKIE_NAME}=`));
      const legacyMatch = parts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
      return mainMatch
        ? mainMatch.split('=').slice(1).join('=')
        : legacyMatch
          ? legacyMatch.split('=').slice(1).join('=')
          : '';
    })();
    const session = parseSessionValue(mainCookie || legacyCookie || fallbackValue);

    if (!session || session.role !== 'customer' || isExpired(session)) {
      return NextResponse.json({ authenticated: false });
    }

    const paletteId = session.customerId || '';
    const posts = await getPostsByPaletteId(paletteId, 20);

    return NextResponse.json({
      authenticated: true,
      paletteId,
      posts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'session error';
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
