'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Stethoscope, CircleCheck, CircleX, ArrowRight, Zap, Info } from 'lucide-react';
import type { AuditCheck } from '@/lib/audit';

type AuditData = { score: number; checks: AuditCheck[]; runAt: string; fetchedUrl: string | null };

const TARGET_SCORE = 70; // 引用候補圏の推奨目標

/** スコアゾーン: 0-49 土台不足 / 50-69 基礎OK・引用候補圏外 / 70-84 引用候補圏 / 85-100 優秀 */
const scoreZone = (score: number): { label: string; color: string; bg: string } => {
  if (score >= 85) return { label: '優秀', color: '#0d7a54', bg: '#dff2e9' };
  if (score >= TARGET_SCORE) return { label: '引用候補圏', color: '#1a9e6e', bg: '#eaf6f0' };
  if (score >= 50) return { label: '基礎OK・引用候補圏外', color: '#c98a10', bg: '#fdf3df' };
  return { label: '土台不足', color: '#c9364b', bg: '#fdeaec' };
};

const scoreColor = (score: number) => scoreZone(score).color;

export default function AuditView({
  siteUrl,
  initialAudit,
  history,
}: {
  siteUrl: string | null;
  initialAudit: AuditData | null;
  history: Array<{ runAt: string; score: number }>;
}) {
  const [audit, setAudit] = useState(initialAudit);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/app/audit', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || '診断に失敗しました。');
      } else {
        setAudit(data.audit);
      }
    } catch {
      setError('通信エラーが発生しました。');
    }
    setRunning(false);
  };

  const fails = audit?.checks.filter((c) => c.passed === false) ?? [];
  const passes = audit?.checks.filter((c) => c.passed === true) ?? [];

  // クイックウィン: 未達チェックをweight降順で上位3件。「+◯点」= weight/対象総weight×100 の概算
  const totalWeight = (audit?.checks ?? [])
    .filter((c) => c.passed !== null)
    .reduce((a, c) => a + c.weight, 0);
  const quickWins = [...fails]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => ({ ...c, gain: totalWeight > 0 ? Math.max(Math.round((c.weight / totalWeight) * 100), 1) : 0 }));

  const zone = audit ? scoreZone(audit.score) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">サイト診断（AIOスコア）</h1>
          <p className="text-xs font-bold opacity-50 mt-1">
            {siteUrl ? `対象: ${siteUrl}` : 'サイトURLが未設定です。プロジェクト設定で登録してください。'}
            ・AIに引用されやすいサイトかを機械診断します（毎週自動実行）
          </p>
        </div>
        <button
          onClick={run}
          disabled={running || !siteUrl}
          className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40"
          style={{ background: 'var(--opt-accent)' }}
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Stethoscope size={15} />}
          {running ? '診断中...' : '今すぐ診断'}
        </button>
      </div>

      {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {!audit ? (
        <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
          <p className="text-sm font-black" style={{ color: 'var(--opt-accent-dark)' }}>
            まだ診断がありません。「今すぐ診断」を押してください（数秒で完了）。
          </p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-[#eadfe7] p-6 text-center">
              <p className="text-xs font-black opacity-60 mb-2">AIOスコア</p>
              <p className="text-6xl font-black" style={{ color: scoreColor(audit.score) }}>
                {audit.score}
              </p>
              {zone && (
                <span
                  className="inline-block mt-2 text-[11px] font-black px-3 py-1 rounded-full"
                  style={{ color: zone.color, background: zone.bg }}
                >
                  {zone.label}
                </span>
              )}
              {audit.score < TARGET_SCORE && (
                <p className="text-[11px] font-black mt-2" style={{ color: 'var(--opt-accent-dark)' }}>
                  あと{TARGET_SCORE - audit.score}点で引用候補圏（目標{TARGET_SCORE}点）
                </p>
              )}
              <p className="text-[10px] font-bold opacity-40 mt-2">
                {new Date(audit.runAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 時点
              </p>
            </div>
            <div className="sm:col-span-2 bg-white rounded-3xl border border-[#eadfe7] p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black opacity-60">スコア推移</p>
                <p className="text-[10px] font-bold opacity-40 flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: '#1a9e6e' }} />
                  目標{TARGET_SCORE}点＝引用候補圏
                </p>
              </div>
              {history.length <= 1 ? (
                <p className="text-xs font-bold opacity-40 py-6">診断を重ねると推移が表示されます。</p>
              ) : (
                <div className="relative h-28 mt-3">
                  {/* 目標ライン（バーの高さ=スコア%と同じ座標系） */}
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none z-10"
                    style={{ bottom: `${TARGET_SCORE}%`, borderColor: '#1a9e6e', opacity: 0.6 }}
                  >
                    <span className="absolute right-0 -top-4 text-[9px] font-black" style={{ color: '#1a9e6e' }}>
                      目標{TARGET_SCORE}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 h-full">
                    {history.map((h, i) => (
                      <div key={i} className="flex-1 relative h-full">
                        <div
                          className="absolute bottom-0 w-full rounded-t-md"
                          style={{ height: `${Math.max(h.score, 3)}%`, background: scoreColor(h.score) }}
                        />
                        <span
                          className="absolute w-full text-center text-[9px] font-black opacity-50"
                          style={{ bottom: `min(${Math.max(h.score, 3)}% + 2px, calc(100% - 12px))` }}
                        >
                          {h.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* スコアの読み方 */}
          <div className="rounded-2xl border px-5 py-4 flex items-start gap-3" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--opt-accent-dark)' }} />
            <p className="text-xs font-bold opacity-70 leading-relaxed">
              AIOスコアは「AIがあなたのサイトを読み取り・引用できる状態か」の技術的整備度です。
              <span className="font-black">{TARGET_SCORE}点以上が引用候補の目安</span>。
              ただしスコアは土台で、実際に言及されるかは競合や口コミ等も影響するため、
              ダッシュボードの<Link href="/main" className="underline font-black">AI言及率</Link>とセットで見てください。
            </p>
          </div>

          {/* クイックウィン */}
          {quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-black flex items-center gap-2 mb-3">
                <Zap size={16} style={{ color: 'var(--opt-accent)' }} /> クイックウィン — まず直すと効く{quickWins.length}項目
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {quickWins.map((c) => (
                  <div key={c.key} className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                    <p className="text-lg font-black mb-1" style={{ color: 'var(--opt-accent-dark)' }}>
                      +{c.gain}点<span className="text-[10px] opacity-50 font-bold ml-1">（概算）</span>
                    </p>
                    <p className="text-xs font-black">{c.label}</p>
                    {c.howToFix && <p className="text-[11px] font-bold opacity-60 mt-1.5 leading-relaxed">→ {c.howToFix}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {fails.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black flex items-center gap-2">
                  <CircleX size={16} className="text-[#c9364b]" /> 要改善（{fails.length}件）
                </h2>
                <Link
                  href="/main/actions"
                  className="flex items-center gap-1 text-xs font-black underline"
                  style={{ color: 'var(--opt-accent-dark)' }}
                >
                  改善タスクを見る <ArrowRight size={12} />
                </Link>
              </div>
              <div className="bg-white rounded-3xl border border-[#eadfe7] divide-y divide-[#f2ecf1]">
                {fails.map((c) => (
                  <div key={c.key} className="px-6 py-4">
                    <p className="text-sm font-black">{c.label}</p>
                    <p className="text-xs font-bold opacity-60 mt-1">{c.detail}</p>
                    {c.howToFix && (
                      <p className="text-xs font-bold mt-1.5" style={{ color: 'var(--opt-accent-dark)' }}>
                        → {c.howToFix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {passes.length > 0 && (
            <div>
              <h2 className="text-sm font-black flex items-center gap-2 mb-3">
                <CircleCheck size={16} className="text-[#1a9e6e]" /> 合格（{passes.length}件）
              </h2>
              <div className="bg-white rounded-3xl border border-[#eadfe7] divide-y divide-[#f2ecf1]">
                {passes.map((c) => (
                  <div key={c.key} className="px-6 py-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-bold">{c.label}</p>
                    <p className="text-[11px] font-bold opacity-40 truncate max-w-[50%]">{c.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
