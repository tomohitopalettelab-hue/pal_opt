import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import {
  getProjectByPaletteId,
  getHubData,
  setHubState,
  listHubFaqSuggestions,
  insertHubFaqSuggestions,
  getHubFaqSuggestion,
  setHubFaqSuggestionStatus,
  listMissedPrompts,
} from '@/lib/db';
import { upsertHubToStudio, generateHubFaqDrafts } from '@/lib/studio';

export const maxDuration = 120;

/**
 * ハブFAQの承認フロー。
 * POST: 「AIに言及されなかった質問」からQ&A案を生成（提案として保存・自動追記はしない）
 * PATCH: { suggestionId, status: 'approved' | 'dismissed' | 'open' }
 *  - approved: ハブのFAQに追記し、有効ならStudioへ再upsert
 */

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  try {
    const [missed, hubData, existing] = await Promise.all([
      listMissedPrompts(project.id, 8),
      getHubData(project.id),
      listHubFaqSuggestions(project.id),
    ]);
    if (missed.length === 0) {
      return NextResponse.json({
        success: false,
        error: '直近14日で「AIに言及されなかった質問」がまだありません。計測が進んでから再度お試しください。',
      }, { status: 400 });
    }

    const existingQuestions = [
      ...(hubData?.faq ?? []).map((f) => f.q),
      ...existing.filter((s) => s.status !== 'dismissed').map((s) => s.question),
    ];
    const drafts = await generateHubFaqDrafts(project, missed, existingQuestions);
    if (drafts.length === 0) {
      return NextResponse.json({ success: false, error: '新しいQ&A案を生成できませんでした（既存FAQと重複している可能性があります）。' }, { status: 400 });
    }

    await insertHubFaqSuggestions(project.id, drafts);
    const suggestions = await listHubFaqSuggestions(project.id);
    return NextResponse.json({ success: true, suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { suggestionId?: number; status?: string };
  const suggestionId = Number(body.suggestionId);
  const status = String(body.status || '');
  if (!Number.isInteger(suggestionId) || !['approved', 'dismissed', 'open'].includes(status)) {
    return NextResponse.json({ success: false, error: 'suggestionId / status が不正です。' }, { status: 400 });
  }

  const suggestion = await getHubFaqSuggestion(project.id, suggestionId);
  if (!suggestion) return NextResponse.json({ success: false, error: '提案が見つかりません。' }, { status: 404 });

  try {
    if (status === 'approved') {
      const data = await getHubData(project.id);
      if (!data || !data.businessName) {
        return NextResponse.json({ success: false, error: '先にハブページを有効化してください。' }, { status: 400 });
      }
      if (!data.faq.some((f) => f.q === suggestion.question)) {
        data.faq = [...data.faq, { q: suggestion.question, a: suggestion.answer }].slice(0, 50);
      }
      // Studioへの反映を先に行い、成功してから承認済みにする（片side更新を防ぐ）
      if (project.hubEnabled) {
        await upsertHubToStudio(project, data, true);
      }
      await setHubState(project.id, { data });
      await setHubFaqSuggestionStatus(project.id, suggestionId, 'approved');
      const suggestions = await listHubFaqSuggestions(project.id);
      return NextResponse.json({ success: true, suggestions, hubData: data });
    }

    await setHubFaqSuggestionStatus(project.id, suggestionId, status as 'dismissed' | 'open');
    const suggestions = await listHubFaqSuggestions(project.id);
    return NextResponse.json({ success: true, suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : '更新に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
