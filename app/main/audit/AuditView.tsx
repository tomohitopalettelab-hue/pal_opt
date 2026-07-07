'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Stethoscope, CircleCheck, CircleX, ArrowRight } from 'lucide-react';
import type { AuditCheck } from '@/lib/audit';

type AuditData = { score: number; checks: AuditCheck[]; runAt: string; fetchedUrl: string | null };

const scoreColor = (score: number) => (score >= 80 ? '#1a9e6e' : score >= 50 ? '#c98a10' : '#c9364b');

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
              <p className="text-[10px] font-bold opacity-40 mt-2">
                {new Date(audit.runAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 時点
              </p>
            </div>
            <div className="sm:col-span-2 bg-white rounded-3xl border border-[#eadfe7] p-6">
              <p className="text-xs font-black opacity-60 mb-3">スコア推移</p>
              {history.length <= 1 ? (
                <p className="text-xs font-bold opacity-40 py-6">診断を重ねると推移が表示されます。</p>
              ) : (
                <div className="flex items-end gap-2 h-24">
                  {history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <span className="text-[9px] font-black opacity-50">{h.score}</span>
                      <div className="w-full rounded-t-md" style={{ height: `${Math.max(h.score, 3)}%`, background: scoreColor(h.score) }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
