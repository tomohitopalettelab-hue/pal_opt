import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getProjectGoogleToken } from '@/lib/db';
import { refreshAccessToken } from '@/lib/google';
import { generateLocalPostDraft, sendLocalPost } from '@/lib/gbp-write';

export const maxDuration = 60;

/** POST: 投稿案の生成（送信しない）。body: { theme? } */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { theme?: string };
  try {
    const draft = await generateLocalPostDraft(project, String(body.theme || '').trim());
    return NextResponse.json({ success: true, draft });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PUT: 承認済み投稿の送信。body: { summary } */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });
  if (!project.googleConnected || !project.gbpLocation) {
    return NextResponse.json({ success: false, error: 'Google連携と店舗選択が必要です。' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { summary?: string };
  const summary = String(body.summary || '').trim();
  if (!summary) return NextResponse.json({ success: false, error: '投稿内容が空です。' }, { status: 400 });

  try {
    const refreshToken = await getProjectGoogleToken(project.id);
    const token = await refreshAccessToken(refreshToken || '');
    await sendLocalPost(token, project.gbpLocation, summary, project.siteUrl);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '投稿に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
