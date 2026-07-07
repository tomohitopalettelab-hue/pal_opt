import Link from 'next/link';
import { Radar, Quote, TrendingUp, Stethoscope, Wrench } from 'lucide-react';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getDailyStats, listRuns, listPrompts, getLatestAudit, listActions } from '@/lib/db';
import { ENGINE_LABELS, type Engine } from '@/lib/engines';
import Onboarding from './Onboarding';

export const dynamic = 'force-dynamic';

const pct = (num: number, den: number): string => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—');

export default async function MainPage() {
  const session = await getSession();
  if (!session) return null; // middlewareでリダイレクト済み

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const [stats, recentRuns, prompts, audit, actions] = await Promise.all([
    getDailyStats(project.id, 30),
    listRuns(project.id, { limit: 6 }),
    listPrompts(project.id),
    getLatestAudit(project.id),
    listActions(project.id),
  ]);
  const openActions = actions.filter((a) => a.status === 'open').length;
  const doneActions = actions.filter((a) => a.status === 'done').length;

  const activePrompts = prompts.filter((p) => p.active).length;
  const last7 = stats.filter((s) => s.day >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  const byEngine = (engine: string) => {
    const rows = last7.filter((s) => s.engine === engine);
    const total = rows.reduce((a, r) => a + r.total, 0);
    const mentioned = rows.reduce((a, r) => a + r.mentioned, 0);
    const cited = rows.reduce((a, r) => a + r.cited, 0);
    return { total, mentioned, cited };
  };
  const overall = {
    total: last7.reduce((a, r) => a + r.total, 0),
    mentioned: last7.reduce((a, r) => a + r.mentioned, 0),
  };

  // 30日推移（日別言及率）
  const dayMap = new Map<string, { total: number; mentioned: number }>();
  for (const s of stats) {
    const cur = dayMap.get(s.day) ?? { total: 0, mentioned: 0 };
    cur.total += s.total;
    cur.mentioned += s.mentioned;
    dayMap.set(s.day, cur);
  }
  const trend = [...dayMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-black">{project.businessName}</h1>
          <p className="text-xs font-bold opacity-50 mt-1">
            {[project.industry, project.area].filter(Boolean).join(' / ') || 'AI可視性ダッシュボード'} ・
            観測中プロンプト {activePrompts}件
          </p>
        </div>
        <Link href="/main/logs" className="text-xs font-bold underline opacity-60 hover:opacity-100">
          回答ログを見る →
        </Link>
      </div>

      {/* スコアカード */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
          <div className="flex items-center gap-2 mb-3">
            <Radar size={16} style={{ color: 'var(--opt-accent)' }} />
            <span className="text-xs font-black opacity-60">AI可視性スコア（直近7日）</span>
          </div>
          <p className="text-4xl font-black" style={{ color: 'var(--opt-accent-dark)' }}>
            {pct(overall.mentioned, overall.total)}
          </p>
          <p className="text-[11px] font-bold opacity-50 mt-2">
            AIの回答 {overall.total}件中 {overall.mentioned}件で言及
          </p>
        </div>
        {(Object.keys(ENGINE_LABELS) as Engine[]).map((engine) => {
          const e = byEngine(engine);
          return (
            <div key={engine} className="bg-white rounded-3xl border border-[#eadfe7] p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="opacity-40" />
                <span className="text-xs font-black opacity-60">{ENGINE_LABELS[engine]}</span>
              </div>
              <p className="text-4xl font-black">{pct(e.mentioned, e.total)}</p>
              <p className="text-[11px] font-bold opacity-50 mt-2">
                言及 {e.mentioned}/{e.total} ・ 自社サイト引用 {e.cited}件
              </p>
            </div>
          );
        })}
      </div>

      {/* 診断・改善への導線 */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/main/audit" className="bg-white rounded-3xl border border-[#eadfe7] p-6 hover:border-[var(--opt-accent)] transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope size={16} style={{ color: 'var(--opt-accent)' }} />
            <span className="text-xs font-black opacity-60">サイト診断（AIOスコア）</span>
          </div>
          <p className="text-4xl font-black">{audit ? audit.score : '—'}</p>
          <p className="text-[11px] font-bold opacity-50 mt-2">
            {audit ? 'クリックして要改善項目を確認' : 'まだ未診断です。クリックして診断を実行'}
          </p>
        </Link>
        <Link href="/main/actions" className="bg-white rounded-3xl border border-[#eadfe7] p-6 hover:border-[var(--opt-accent)] transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={16} style={{ color: 'var(--opt-accent)' }} />
            <span className="text-xs font-black opacity-60">改善タスク</span>
          </div>
          <p className="text-4xl font-black">
            {openActions}
            <span className="text-sm opacity-40 ml-1">件 未実装</span>
          </p>
          <p className="text-[11px] font-bold opacity-50 mt-2">
            {doneActions > 0 ? `実装済み ${doneActions}件 — 効果は言及率の推移で確認` : 'AIがスコアを上げる施策を成果物付きで生成します'}
          </p>
        </Link>
      </div>

      {/* 30日トレンド */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <p className="text-xs font-black opacity-60 mb-4">言及率の推移（30日）</p>
        {trend.length === 0 ? (
          <p className="text-sm font-bold opacity-40 py-8 text-center">
            まだ計測データがありません。観測は毎日自動で実行されます。
          </p>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {trend.map(([day, v]) => {
              const rate = v.total > 0 ? v.mentioned / v.total : 0;
              return (
                <div key={day} className="flex-1 flex flex-col justify-end group relative">
                  <div
                    className="rounded-t-md min-h-[2px] transition-all"
                    style={{ height: `${Math.max(rate * 100, 2)}%`, background: 'var(--opt-accent)' , opacity: v.total ? 1 : 0.15 }}
                  />
                  <span className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-black text-white rounded px-1.5 py-0.5 whitespace-nowrap">
                    {day.slice(5)}: {Math.round(rate * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 最新のAI回答 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Quote size={16} style={{ color: 'var(--opt-accent)' }} />
          <h2 className="text-sm font-black">最新のAI回答</h2>
        </div>
        {recentRuns.length === 0 ? (
          <div className="rounded-3xl border p-8 text-center" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
            <p className="text-sm font-black mb-1" style={{ color: 'var(--opt-accent-dark)' }}>
              初回計測は本日深夜に自動実行されます
            </p>
            <p className="text-xs font-bold opacity-60">
              観測プロンプトは「観測プロンプト」タブで確認・調整できます。
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {recentRuns.map((run) => (
              <div key={run.id} className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#f2ecf1] opacity-70">
                    {ENGINE_LABELS[run.engine as Engine] ?? run.engine}
                  </span>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                    style={{ background: run.mentioned ? 'var(--opt-accent)' : '#b9aab5' }}
                  >
                    {run.mentioned ? `言及あり${run.mentionPosition ? ` (${run.mentionPosition}位)` : ''}` : '言及なし'}
                  </span>
                </div>
                <p className="text-xs font-black mb-2 opacity-80">Q. {run.promptText}</p>
                <p className="text-xs font-medium opacity-60 leading-relaxed line-clamp-4">{run.answerText || run.error}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
