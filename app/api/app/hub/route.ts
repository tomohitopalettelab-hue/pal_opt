import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import {
  getProjectByPaletteId,
  getHubData,
  setHubState,
  normalizeHubData,
  listHubFaqSuggestions,
  listMissedPrompts,
  type HubData,
  type Project,
} from '@/lib/db';
import { upsertHubToStudio, generateHubFaqDrafts } from '@/lib/studio';

export const maxDuration = 120;

/**
 * AIOハブページ（Studioホストの1枚ページ）の設定API。
 * GET: 現在の状態（有効/URL/コンテンツ/FAQ提案）
 * POST: { action: 'enable' | 'save' | 'disable', data? }
 *  - enable: 初期コンテンツ生成（事業者情報＋言及されなかった質問からの初期FAQ）→ Studioへupsert → URL保存
 *  - save:   編集内容を保存し、有効ならStudioへ再upsert
 *  - disable: 無効化（Studio側も非公開に）
 */

const buildInitialHubData = async (project: Project): Promise<HubData> => {
  const missed = await listMissedPrompts(project.id, 8).catch(() => []);
  const drafts = await generateHubFaqDrafts(project, missed, []).catch(() => []);
  return normalizeHubData({
    businessName: project.businessName,
    description: `${project.area ? project.area + 'の' : ''}${project.industry || '事業者'}「${project.businessName}」のよくある質問と店舗・事業者情報をまとめたご案内ページです。`,
    homepageUrl: project.siteUrl || '',
    sameAs: project.siteUrl ? [project.siteUrl] : [],
    faq: drafts.map((d) => ({ q: d.question, a: d.answer })),
    showColumns: true,
  });
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const [data, suggestions] = await Promise.all([
    getHubData(project.id),
    listHubFaqSuggestions(project.id),
  ]);
  return NextResponse.json({
    success: true,
    hub: { enabled: project.hubEnabled, url: project.hubUrl, data },
    suggestions,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; data?: unknown };
  const action = String(body.action || '');

  try {
    if (action === 'enable') {
      let data = await getHubData(project.id);
      if (!data || !data.businessName) {
        data = await buildInitialHubData(project);
      }
      const { hubUrl } = await upsertHubToStudio(project, data, true);
      await setHubState(project.id, { enabled: true, url: hubUrl, data });
      return NextResponse.json({ success: true, hub: { enabled: true, url: hubUrl, data } });
    }

    if (action === 'save') {
      const data = normalizeHubData(body.data);
      if (!data.businessName) {
        return NextResponse.json({ success: false, error: '事業者名は必須です。' }, { status: 400 });
      }
      let url = project.hubUrl;
      if (project.hubEnabled) {
        const res = await upsertHubToStudio(project, data, true);
        url = res.hubUrl;
      }
      await setHubState(project.id, { data, url });
      return NextResponse.json({ success: true, hub: { enabled: project.hubEnabled, url, data } });
    }

    if (action === 'disable') {
      const data = await getHubData(project.id);
      if (data && data.businessName) {
        // Studio側も非公開へ（失敗してもローカルの無効化は続行し、次回enableで整合させる）
        await upsertHubToStudio(project, data, false).catch(() => {});
      }
      await setHubState(project.id, { enabled: false });
      return NextResponse.json({ success: true, hub: { enabled: false, url: project.hubUrl, data } });
    }

    return NextResponse.json({ success: false, error: 'action が不正です。' }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : '処理に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
