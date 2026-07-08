'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Rocket, Sparkles } from 'lucide-react';

export default function Onboarding() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [area, setArea] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [error, setError] = useState('');

  const handleSuggest = async () => {
    setError('');
    setSuggested(false);
    setSuggesting(true);
    try {
      const res = await fetch('/api/app/project/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || '自動入力に失敗しました。手動で入力してください。');
      } else {
        const s = data.suggestion as { businessName?: string; industry?: string; area?: string; competitors?: string[] };
        if (s.businessName) setBusinessName(s.businessName);
        if (s.industry) setIndustry(s.industry);
        if (s.area) setArea(s.area);
        if (Array.isArray(s.competitors) && s.competitors.length) setCompetitors(s.competitors.join('、'));
        setSuggested(true);
      }
    } catch {
      setError('通信エラーが発生しました。');
    }
    setSuggesting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/app/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          industry,
          area,
          siteUrl,
          competitors: competitors.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || '保存に失敗しました。');
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('通信エラーが発生しました。');
      setLoading(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-white focus:outline-none focus:border-[var(--opt-accent)] text-sm';

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black mb-2">観測プロジェクトを作成</h1>
        <p className="text-sm font-bold opacity-60 leading-relaxed">
          事業者情報を入力すると、AIが「お客さんがAIに聞きそうな質問」を
          <br className="hidden sm:block" />
          自動生成し、毎日の定点観測が始まります。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#eadfe7] p-8 space-y-5">
        <div>
          <label className="block text-xs font-bold opacity-60 mb-1.5">ホームページURL</label>
          <div className="flex gap-2">
            <input className={field} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://..." />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting || loading || !siteUrl.trim()}
              className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-black text-white disabled:opacity-40 whitespace-nowrap"
              style={{ background: 'var(--opt-accent)' }}
            >
              {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {suggesting ? '推定中...' : 'AIで自動入力'}
            </button>
          </div>
          <p className="text-[10px] font-bold opacity-40 mt-1.5">
            URLを入れて「AIで自動入力」を押すと、サイトを読み取って下の項目を自動推定します（修正できます）。
          </p>
          {suggested && (
            <p className="text-[11px] font-black mt-1" style={{ color: 'var(--opt-accent-dark)' }}>
              ✓ 自動入力しました。内容を確認・修正してから「観測を開始する」を押してください。
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold opacity-60 mb-1.5">事業者名（必須）</label>
          <input className={field} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="例: ヘアサロン Palette" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold opacity-60 mb-1.5">業種</label>
            <input className={field} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="例: 美容室" />
          </div>
          <div>
            <label className="block text-xs font-bold opacity-60 mb-1.5">商圏・地域</label>
            <input className={field} value={area} onChange={(e) => setArea(e.target.value)} placeholder="例: 渋谷・原宿" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold opacity-60 mb-1.5">競合（「、」区切りで複数可）</label>
          <input className={field} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="例: サロンA、サロンB" />
        </div>

        {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading || !businessName.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-black transition-opacity disabled:opacity-40"
          style={{ background: 'var(--opt-accent)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
          {loading ? '質問を自動生成中...（30秒ほどかかります）' : '観測を開始する'}
        </button>
      </form>
    </div>
  );
}
