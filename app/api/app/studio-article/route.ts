import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getAction, listMissedPrompts } from '@/lib/db';
import { generateArticle, publishDraftToStudio } from '@/lib/studio';

export const maxDuration = 120;

/**
 * POST: 改善タスクからAIが記事を生成し、Pal Studioへ「下書き」として送稿。
 * body: { actionId }
 * 公開はStudio側で人間が確認して行う（自動公開しない）。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { actionId?: number };
  const actionId = Number(body.actionId);
  if (!Number.isInteger(actionId)) {
    return NextResponse.json({ success: false, error: 'actionId が必要です。' }, { status: 400 });
  }
  const action = await getAction(project.id, actionId);
  if (!action) return NextResponse.json({ success: false, error: 'タスクが見つかりません。' }, { status: 404 });

  try {
    const missed = await listMissedPrompts(project.id, 5);
    const article = await generateArticle(project, action, missed);
    await publishDraftToStudio(project.paletteId, article, `${project.id}-${action.id}`);
    return NextResponse.json({ success: true, title: article.title });
  } catch (e) {
    const message = e instanceof Error ? e.message : '送稿に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
