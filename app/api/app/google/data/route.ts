import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getProjectGoogleToken, listArticles } from '@/lib/db';
import { refreshAccessToken, getGbpSummary, getGscSummary, getGscPages, type GscPageRow } from '@/lib/google';

export const maxDuration = 60;

/** SEO(GSC)/MEO(GBP)のライブデータ＋Studio送稿記事の効果（ベストエフォート） */
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
    const articles = await listArticles(project.id).catch(() => []);

    // 最も古い送稿日（エポックms比較。TIMESTAMPTZの文字列比較はしない）
    const oldestSentMs = articles.reduce((min, a) => {
      const ms = new Date(a.sentAt).getTime();
      return Number.isFinite(ms) && ms < min ? ms : min;
    }, Number.POSITIVE_INFINITY);
    const startDate = Number.isFinite(oldestSentMs)
      ? new Date(oldestSentMs + 9 * 3600e3).toISOString().slice(0, 10)
      : null;

    const [gsc, gbp, blogPages] = await Promise.all([
      project.gscSite ? getGscSummary(token, project.gscSite).catch((e: Error) => ({ error: e.message })) : null,
      project.gbpLocation ? getGbpSummary(token, project.gbpLocation).catch((e: Error) => ({ error: e.message })) : null,
      project.gscSite && startDate
        ? getGscPages(token, project.gscSite, startDate).catch((): GscPageRow[] => [])
        : ([] as GscPageRow[]),
    ]);

    // 送稿記事はブログ配下に公開される想定 → /blog 等を含むページに絞る（厳密一致は不能）
    const blogOnly = blogPages.filter((p) => /\/(blog|posts?|news|column|articles?)(\/|$)/i.test(p.page));
    return NextResponse.json({ success: true, connected: true, gsc, gbp, articles, blogPages: blogOnly });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Google APIエラー';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
