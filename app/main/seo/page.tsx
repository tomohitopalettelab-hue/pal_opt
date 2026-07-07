'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, MapPin, Star } from 'lucide-react';

type GscData = {
  clicks: number;
  impressions: number;
  avgPosition: number | null;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  error?: string;
};
type GbpData = {
  averageRating: number | null;
  totalReviewCount: number;
  unreplied: number;
  recent: Array<{ reviewer: string; starRating: number; comment: string; createTime: string; hasReply: boolean }>;
  error?: string;
};

export default function SeoMeoPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [gsc, setGsc] = useState<GscData | null>(null);
  const [gbp, setGbp] = useState<GbpData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/app/google/data');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setError(data?.error || 'データ取得に失敗しました。');
        } else {
          setConnected(Boolean(data.connected));
          setGsc(data.gsc);
          setGbp(data.gbp);
        }
      } catch {
        setError('通信エラーが発生しました。');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 size={20} className="animate-spin opacity-40" />;

  if (!connected) {
    return (
      <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
        <p className="text-sm font-black mb-2" style={{ color: 'var(--opt-accent-dark)' }}>
          SEO/MEOデータの表示にはGoogle連携が必要です
        </p>
        <Link href="/main/connect" className="text-xs font-black underline">連携設定へ →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-black">SEO / MEO</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          Search Consoleの実測データ（直近28日）とGoogleビジネスプロフィールの口コミ状況。
          <Link href="/main/connect" className="underline ml-2">連携設定</Link>
        </p>
      </div>

      {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* SEO (GSC) */}
      <div>
        <h2 className="text-sm font-black flex items-center gap-2 mb-3">
          <Search size={15} style={{ color: 'var(--opt-accent)' }} /> SEO — Google検索の実測（Search Console）
        </h2>
        {!gsc ? (
          <p className="text-xs font-bold opacity-40 bg-white rounded-2xl border border-[#eadfe7] p-5">
            Search Consoleのサイトが未選択です。<Link href="/main/connect" className="underline">連携設定</Link>で選択してください。
          </p>
        ) : gsc.error ? (
          <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{gsc.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'クリック数', value: gsc.clicks },
                { label: '表示回数', value: gsc.impressions },
                { label: '平均掲載順位', value: gsc.avgPosition ?? '—' },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                  <p className="text-[10px] font-black opacity-40 mb-1">{c.label}</p>
                  <p className="text-3xl font-black">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-[#eadfe7] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-black opacity-50 border-b border-[#f2ecf1]">
                    <th className="px-5 py-3">検索クエリ</th>
                    <th className="px-5 py-3 text-right">クリック</th>
                    <th className="px-5 py-3 text-right">表示</th>
                    <th className="px-5 py-3 text-right">順位</th>
                  </tr>
                </thead>
                <tbody>
                  {gsc.topQueries.map((q) => (
                    <tr key={q.query} className="border-b border-[#f7f2f6] font-bold">
                      <td className="px-5 py-2.5">{q.query}</td>
                      <td className="px-5 py-2.5 text-right">{q.clicks}</td>
                      <td className="px-5 py-2.5 text-right">{q.impressions}</td>
                      <td className="px-5 py-2.5 text-right font-black">{q.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MEO (GBP) */}
      <div>
        <h2 className="text-sm font-black flex items-center gap-2 mb-3">
          <MapPin size={15} style={{ color: 'var(--opt-accent)' }} /> MEO — Googleビジネスプロフィール
        </h2>
        {!gbp ? (
          <p className="text-xs font-bold opacity-40 bg-white rounded-2xl border border-[#eadfe7] p-5">
            店舗が未選択です。<Link href="/main/connect" className="underline">連携設定</Link>で選択してください。
          </p>
        ) : gbp.error ? (
          <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{gbp.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                <p className="text-[10px] font-black opacity-40 mb-1">平均評価</p>
                <p className="text-3xl font-black flex items-center gap-1">
                  {gbp.averageRating ?? '—'} <Star size={18} fill="currentColor" style={{ color: '#e8b931' }} />
                </p>
              </div>
              <div className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                <p className="text-[10px] font-black opacity-40 mb-1">口コミ総数</p>
                <p className="text-3xl font-black">{gbp.totalReviewCount}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#eadfe7] p-5">
                <p className="text-[10px] font-black opacity-40 mb-1">未返信</p>
                <p className={`text-3xl font-black ${gbp.unreplied > 0 ? 'text-red-600' : ''}`}>{gbp.unreplied}</p>
                <p className="text-[10px] font-bold opacity-40">口コミ返信はAIOにも効きます</p>
              </div>
            </div>
            <div className="space-y-3">
              {gbp.recent.map((r, i) => (
                <div key={i} className="bg-white rounded-3xl border border-[#eadfe7] px-6 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black">
                      {r.reviewer}
                      <span className="ml-2" style={{ color: '#e8b931' }}>{'★'.repeat(r.starRating)}</span>
                    </p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r.hasReply ? 'bg-[#eaf6f0] text-[#1a9e6e]' : 'bg-red-50 text-red-600'}`}>
                      {r.hasReply ? '返信済み' : '未返信'}
                    </span>
                  </div>
                  <p className="text-xs font-medium opacity-60 leading-relaxed">{r.comment || '（コメントなし）'}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
