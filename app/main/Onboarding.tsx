'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Rocket } from 'lucide-react';

export default function Onboarding() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [area, setArea] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          <label className="block text-xs font-bold opacity-60 mb-1.5">ホームページURL</label>
          <input className={field} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://..." />
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
