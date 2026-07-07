import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, setProjectGoogleToken } from '@/lib/db';
import { exchangeCode } from '@/lib/google';

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  const redirectTo = (path: string, err?: string) => {
    const url = new URL(path, appUrl);
    if (err) url.searchParams.set('error', err.slice(0, 200));
    return NextResponse.redirect(url.toString());
  };

  try {
    const session = await getSession();
    if (!session) return redirectTo('/login');

    const project = await getProjectByPaletteId(session.paletteId);
    if (!project) return redirectTo('/main');

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const cookieStore = await cookies();
    const savedState = cookieStore.get('google_oauth_state')?.value;
    cookieStore.delete('google_oauth_state');

    if (!code || !state || !savedState || state !== savedState) {
      return redirectTo('/main/connect', '認可フローが不正です。もう一度お試しください。');
    }

    const { refreshToken } = await exchangeCode(code);
    if (!refreshToken) {
      return redirectTo('/main/connect', 'refresh tokenが取得できませんでした。もう一度お試しください。');
    }
    await setProjectGoogleToken(project.id, refreshToken);
    return redirectTo('/main/connect');
  } catch (e) {
    const message = e instanceof Error ? e.message : '連携に失敗しました。';
    return redirectTo('/main/connect', message);
  }
}
