'use client';

import { useState } from 'react';
import { Loader2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Prompt } from '@/lib/db';

export default function PromptList({ initialPrompts }: { initialPrompts: Prompt[] }) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (promptId: number, active: boolean) => {
    setPrompts((ps) => ps.map((p) => (p.id === promptId ? { ...p, active } : p)));
    const res = await fetch('/api/app/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, active }),
    });
    if (!res.ok) {
      setPrompts((ps) => ps.map((p) => (p.id === promptId ? { ...p, active: !active } : p)));
    }
  };

  const generateMore = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/app/prompts', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || '生成に失敗しました。');
      } else {
        setPrompts(data.prompts);
      }
    } catch {
      setError('通信エラーが発生しました。');
    }
    setGenerating(false);
  };

  const categories = [...new Set(prompts.map((p) => p.category))];

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-black opacity-50 mb-2">{cat}</p>
          <div className="bg-white rounded-3xl border border-[#eadfe7] divide-y divide-[#f2ecf1]">
            {prompts
              .filter((p) => p.category === cat)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                  <p className={`text-sm font-bold ${p.active ? '' : 'opacity-30 line-through'}`}>{p.text}</p>
                  <button onClick={() => toggle(p.id, !p.active)} className="shrink-0">
                    {p.active ? (
                      <ToggleRight size={28} style={{ color: 'var(--opt-accent)' }} />
                    ) : (
                      <ToggleLeft size={28} className="opacity-30" />
                    )}
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}

      {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={generateMore}
        disabled={generating}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40"
        style={{ background: 'var(--opt-accent)' }}
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {generating ? '生成中...' : 'AIで質問を追加生成'}
      </button>
    </div>
  );
}
