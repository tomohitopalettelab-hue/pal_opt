import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getProjectGoogleToken } from '@/lib/db';
import { refreshAccessToken, getGbpSummary, getGscSummary } from '@/lib/google';

export const maxDuration = 60;

/** SEO(GSC)/MEO(GBP)のライブデータ */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });
  if (!project.googleConnected) {
    return NextResponse.json({ success: true, connected: false });
  }

  try {
    const refreshToken = await getProjectGoogleToken(project.id);
    const token = await refreshAccessToken(refreshToken || '');
    const [gsc, gbp] = await Promise.all([
      project.gscSite ? getGscSummary(token, project.gscSite).catch((e: Error) => ({ error: e.message })) : null,
      project.gbpLocation ? getGbpSummary(token, project.gbpLocation).catch((e: Error) => ({ error: e.message })) : null,
    ]);
    return NextResponse.json({ success: true, connected: true, gsc, gbp });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Google APIエラー';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
