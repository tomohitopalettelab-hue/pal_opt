import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getProjectGoogleToken } from '@/lib/db';
import { refreshAccessToken } from '@/lib/google';
import { generateReplyDraft, sendReviewReply } from '@/lib/gbp-write';

export const maxDuration = 60;

/** POST: AI返信案の生成（送信しない）。body: { reviewer, starRating, comment, style? } */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    reviewer?: string;
    starRating?: number;
    comment?: string;
    style?: string;
  };
  try {
    const draft = await generateReplyDraft(
      project,
      {
        reviewer: String(body.reviewer || '匿名'),
        starRating: Math.min(Math.max(Number(body.starRating) || 5, 1), 5),
        comment: String(body.comment || ''),
      },
      body.style === 'フレンドリー' ? 'フレンドリー' : '丁寧',
    );
    return NextResponse.json({ success: true, draft });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PUT: 承認済み返信の送信。body: { reviewId, comment } */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });
  if (!project.googleConnected || !project.gbpLocation) {
    return NextResponse.json({ success: false, error: 'Google連携と店舗選択が必要です。' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { reviewId?: string; comment?: string };
  const reviewId = String(body.reviewId || '').trim();
  const comment = String(body.comment || '').trim();
  if (!reviewId || !comment) {
    return NextResponse.json({ success: false, error: 'reviewId と comment は必須です。' }, { status: 400 });
  }

  try {
    const refreshToken = await getProjectGoogleToken(project.id);
    const token = await refreshAccessToken(refreshToken || '');
    await sendReviewReply(token, project.gbpLocation, reviewId, comment);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '送信に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
