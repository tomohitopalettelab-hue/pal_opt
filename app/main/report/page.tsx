import Link from 'next/link';
import { getSession } from '@/lib/session-server';
import {
  getProjectByPaletteId,
  getMonthlySummary,
  getShareOfVoice,
  getTopCitations,
  getAuditHistory,
} from '@/lib/db';
import { ENGINE_LABELS, type Engine } from '@/lib/engines';
import { Printer } from 'lucide-react';
import Onboarding from '../Onboarding';

export const dynamic = 'force-dynamic';

const jstNow = () => new Date(Date.now() + 9 * 3600e3);
const currentMonth = () => jstNow().toISOString().slice(0, 7);
const shiftMonth = (month: string, diff: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + diff, 1));
  return d.toISOString().slice(0, 7);
};
const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 100) : null);
// TIMESTAMPTZ文字列→JST "M/D"（エポックms経由。文字列ソート/比較はしない）
const fmtJstDay = (s: string | null): string | null => {
  if (!s) return null;
  const ms = new Date(s).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();

  const [summary, sov, citations, auditHistory] = await Promise.all([
    getMonthlySummary(project.id, month),
    getShareOfVoice(project.id, 30),
    getTopCitations(project.id, 30),
    getAuditHistory(project.id, 6),
  ]);

  const mentionRate = pct(summary.mentionedRuns, summary.totalRuns);
  const diff = mentionRate !== null && summary.prevMentionRate !== null ? mentionRate - summary.prevMentionRate : null;
  const sovTotal = sov.reduce((a, s) => a + s.mentions, 0);
  const latestAuditScore = auditHistory.length ? auditHistory[auditHistory.length - 1].score : null;

  return (
    <div className="space-y-8 print:text-black">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black">月次レポート</h1>
          <div className="flex items-center gap-2 text-xs font-black">
            <Link href={`/main/report?month=${shiftMonth(month, -1)}`} className="px-2 py-1 rounded-lg bg-white border border-[#eadfe7]">←</Link>
            <span>{month.replace('-', '年')}月</span>
            {month < currentMonth() && (
              <Link href={`/main/report?month=${shiftMonth(month, 1)}`} className="px-2 py-1 rounded-lg bg-white border border-[#eadfe7]">→</Link>
            )}
          </div>
        </div>
        <a
          href="javascript:window.print()"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white"
          style={{ background: 'var(--opt-accent)' }}
        >
          <Printer size={14} /> 印刷 / PDF保存
        </a>
      </div>

      {/* レポートヘッダ（印刷用） */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-8">
        <p className="text-[11px] font-black opacity-40 mb-1">Pal Opt — AI検索最適化 月次レポート</p>
        <h2 className="text-2xl font-black">{project.businessName}</h2>
        <p className="text-xs font-bold opacity-50 mt-1">
          {month.replace('-', '年')}月 ・ {[project.industry, project.area].filter(Boolean).join(' / ')}
        </p>

        <div className="grid sm:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-[10px] font-black opacity-40">AI言及率</p>
            <p className="text-3xl font-black" style={{ color: 'var(--opt-accent-dark)' }}>
              {mentionRate !== null ? `${mentionRate}%` : '—'}
              {diff !== null && (
                <span className={`text-sm ml-2 ${diff >= 0 ? 'text-[#1a9e6e]' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{diff}pt
                </span>
              )}
            </p>
            <p className="text-[10px] font-bold opacity-40">前月比{summary.prevMentionRate !== null ? `（前月 ${summary.prevMentionRate}%）` : '（前月データなし）'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black opacity-40">計測回数</p>
            <p className="text-3xl font-black">{summary.totalRuns}</p>
            <p className="text-[10px] font-bold opacity-40">言及 {summary.mentionedRuns}件 / 自社引用 {summary.citedRuns}件</p>
          </div>
          <div>
            <p className="text-[10px] font-black opacity-40">AIOスコア</p>
            <p className="text-3xl font-black">{latestAuditScore ?? '—'}</p>
            <p className="text-[10px] font-bold opacity-40">サイト診断（最新）</p>
          </div>
          <div>
            <p className="text-[10px] font-black opacity-40">実装した施策</p>
            <p className="text-3xl font-black">{summary.doneActions.length}<span className="text-sm opacity-40">件</span></p>
          </div>
        </div>
      </div>

      {/* エンジン別 */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <p className="text-xs font-black opacity-60 mb-4">エンジン別の言及率</p>
        <div className="space-y-3">
          {summary.byEngine.map((e) => {
            const rate = pct(e.mentioned, e.total) ?? 0;
            return (
              <div key={e.engine} className="flex items-center gap-3">
                <span className="text-xs font-black w-48 shrink-0">{ENGINE_LABELS[e.engine as Engine] ?? e.engine}</span>
                <div className="flex-1 h-4 rounded-full bg-[#f2ecf1] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${rate}%`, background: 'var(--opt-accent)' }} />
                </div>
                <span className="text-xs font-black w-20 text-right">{rate}%（{e.mentioned}/{e.total}）</span>
              </div>
            );
          })}
          {summary.byEngine.length === 0 && <p className="text-xs font-bold opacity-40">この月の計測データがありません。</p>}
        </div>

        {/* 今月実装した施策（日付つき・言及率と対応づけて見る） */}
        <div className="mt-5 pt-4 border-t border-[#f2ecf1]">
          <p className="text-xs font-black opacity-60 mb-1">今月実装した施策</p>
          <p className="text-[10px] font-bold opacity-40 mb-3">実装日以降の言及率の変化とあわせてご覧ください（ダッシュボードのグラフに実装日のマーカーを表示しています）</p>
          {summary.doneActions.length === 0 ? (
            <p className="text-xs font-bold opacity-40">この月に実装済みにした施策はありません。</p>
          ) : (
            <ul className="space-y-2">
              {summary.doneActions.map((a, i) => {
                const day = fmtJstDay(a.doneAt);
                return (
                  <li key={i} className="text-xs font-bold flex items-start gap-2">
                    <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: 'var(--opt-accent)' }}>
                      {day ?? '—'}
                    </span>
                    <span>{a.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 競合SoV */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <p className="text-xs font-black opacity-60 mb-1">Share of Voice（直近30日・AI回答内の言及回数）</p>
        <p className="text-[10px] font-bold opacity-40 mb-4">AIの回答の中で、自社と競合がそれぞれ何回名前を挙げられたか</p>
        <div className="space-y-2.5">
          {sov.map((s) => {
            const share = sovTotal > 0 ? Math.round((s.mentions / sovTotal) * 100) : 0;
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className={`text-xs w-44 shrink-0 truncate ${s.isSelf ? 'font-black' : 'font-bold opacity-60'}`}>
                  {s.isSelf ? `★ ${s.name}` : s.name}
                </span>
                <div className="flex-1 h-3.5 rounded-full bg-[#f2ecf1] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${share}%`, background: s.isSelf ? 'var(--opt-accent)' : '#c4b2c0' }} />
                </div>
                <span className="text-xs font-black w-24 text-right">{s.mentions}回（{share}%）</span>
              </div>
            );
          })}
          {sovTotal === 0 && <p className="text-xs font-bold opacity-40">まだ言及データがありません。</p>}
        </div>
      </div>

      {/* AIが引用した情報源 */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <p className="text-xs font-black opacity-60 mb-1">AIが引用した情報源（直近30日）</p>
        <p className="text-[10px] font-bold opacity-40 mb-3">ここに載ることがAIOの近道です（掲載・口コミ獲得の営業先リスト）</p>
        {citations.length === 0 ? (
          <p className="text-xs font-bold opacity-40">引用データがありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {citations.slice(0, 8).map((c) => (
              <li key={c.domain} className="text-xs font-bold flex justify-between">
                <span>{c.domain}</span>
                <span className="opacity-40">{c.count}回</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ベスト回答 */}
      {summary.bestAnswers.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
          <p className="text-xs font-black opacity-60 mb-4">今月のハイライト — AIがあなたをこう紹介しました</p>
          <div className="space-y-4">
            {summary.bestAnswers.map((b, i) => (
              <div key={i} className="border-l-4 pl-4" style={{ borderColor: 'var(--opt-accent)' }}>
                <p className="text-xs font-black opacity-70">
                  Q. {b.promptText}
                  <span className="opacity-50 font-bold">（{ENGINE_LABELS[b.engine as Engine] ?? b.engine}{b.mentionPosition ? `・${b.mentionPosition}番目に紹介` : ''}）</span>
                </p>
                <p className="text-xs font-medium opacity-60 mt-1 line-clamp-3 leading-relaxed">{b.answerText}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
