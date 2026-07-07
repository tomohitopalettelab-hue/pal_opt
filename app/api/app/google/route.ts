import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import {
  getProjectByPaletteId,
  getProjectGoogleToken,
  setProjectGoogleSelection,
  setProjectGoogleToken,
} from '@/lib/db';
import { refreshAccessToken, listGbpLocations, listGscSites } from '@/lib/google';

export const maxDuration = 60;

/** 連携状態＋選択肢（GBPロケーション/GSCサイト一覧） */
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
    const [locations, sites] = await Promise.all([
      listGbpLocations(token).catch(() => []),
      listGscSites(token).catch(() => []),
    ]);
    return NextResponse.json({
      success: true,
      connected: true,
      gbpLocation: project.gbpLocation,
      gscSite: project.gscSite,
      locations,
      sites,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Google APIエラー';
    return NextResponse.json({ success: true, connected: true, error: message, locations: [], sites: [] });
  }
}

/** { gbpLocation?, gscSite? } の選択保存 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { gbpLocation?: string; gscSite?: string };
  await setProjectGoogleSelection(project.id, {
    gbpLocation: body.gbpLocation !== undefined ? String(body.gbpLocation) || null : undefined,
    gscSite: body.gscSite !== undefined ? String(body.gscSite) || null : undefined,
  });
  return NextResponse.json({ success: true });
}

/** 連携解除 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  await setProjectGoogleToken(project.id, null);
  await setProjectGoogleSelection(project.id, { gbpLocation: null, gscSite: null });
  return NextResponse.json({ success: true });
}
