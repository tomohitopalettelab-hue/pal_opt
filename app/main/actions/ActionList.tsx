'use client';

import { useState } from 'react';
import { Loader2, Wand2, Check, Copy, Undo2, X } from 'lucide-react';
import type { Action } from '@/lib/db';

const CATEGORY_LABELS: Record<string, string> = {
  structured_data: '構造化データ',
  faq: 'FAQ',
  robots: 'AIクローラー',
  meta: 'サイト基本設定',
  content: 'コンテンツ施策',
  other: 'その他',
};

export default function ActionList({ initialActions }: { initialActions: Action[] }) {
  const [actions, setActions] = useState(initialActions);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/app/actions', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || '生成に失敗しました。');
      } else {
        setActions(data.actions);
      }
    } catch {
      setError('通信エラーが発生しました。');
    }
    setGenerating(false);
  };

  const setStatus = async (actionId: number, status: Action['status']) => {
    const prev = actions;
    setActions((as) => as.map((a) => (a.id === actionId ? { ...a, status } : a)));
    const res = await fetch('/api/app/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, status }),
    });
    if (!res.ok) setActions(prev);
  };

  const copy = async (a: Action) => {
    if (!a.deliverable) return;
    await navigator.clipboard.writeText(a.deliverable);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const open = actions.filter((a) => a.status === 'open');
  const done = actions.filter((a) => a.status === 'done');

  const card = (a: Action) => (
    <details key={a.id} className="bg-white rounded-3xl border border-[#eadfe7] px-6 py-4">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#f2ecf1] opacity-70 mr-2">
            {CATEGORY_LABELS[a.category] ?? a.category}
          </span>
          <span className={`text-sm font-black ${a.status === 'done' ? 'opacity-40 line-through' : ''}`}>{a.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.status === 'open' ? (
            <>
              <button
                onClick={(e) => { e.preventDefault(); setStatus(a.id, 'done'); }}
                className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full text-white"
                style={{ background: 'var(--opt-accent)' }}
              >
                <Check size={12} /> 実装済みにする
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setStatus(a.id, 'dismissed'); }}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-full opacity-40 hover:opacity-80"
              >
                <X size={12} /> 却下
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); setStatus(a.id, 'open'); }}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-full opacity-40 hover:opacity-80"
            >
              <Undo2 size={12} /> 未実装に戻す
            </button>
          )}
        </div>
      </summary>
      <div className="mt-3 pt-3 border-t border-[#f2ecf1]">
        <p className="text-xs font-bold opacity-70 leading-relaxed">{a.description}</p>
        {a.deliverable && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-black opacity-40">成果物（そのまま使えます）</p>
              <button
                onClick={() => copy(a)}
                className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-[#f2ecf1] hover:bg-[#e9dfe7]"
              >
                <Copy size={11} /> {copiedId === a.id ? 'コピーしました' : 'コピー'}
              </button>
            </div>
            <pre className="text-[11px] font-medium bg-[#faf7f9] border border-[#f0e8ee] rounded-2xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {a.deliverable}
            </pre>
          </div>
        )}
      </div>
    </details>
  );

  return (
    <div className="space-y-6">
      <button
        onClick={generate}
        disabled={generating}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40"
        style={{ background: 'var(--opt-accent)' }}
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
        {generating ? '診断と計測結果から生成中...（30秒〜1分）' : '改善タスクをAIで生成'}
      </button>

      {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {actions.length === 0 && !generating && (
        <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
          <p className="text-sm font-black" style={{ color: 'var(--opt-accent-dark)' }}>
            まだタスクがありません。上のボタンで生成してください。
          </p>
          <p className="text-xs font-bold opacity-60 mt-1">
            サイト診断と計測データが揃っているほど、具体的なタスクになります。
          </p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black">未実装（{open.length}件）</h2>
          {open.map(card)}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black opacity-50">実装済み（{done.length}件）</h2>
          {done.map(card)}
        </div>
      )}
    </div>
  );
}
