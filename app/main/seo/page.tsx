'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, MapPin, Star, FileText } from 'lucide-react';

type Article = { id: number; title: string; sentAt: string };
type BlogPageRow = { page: string; clicks: number; impressions: number };

type GscData = {
  clicks: number;
  impressions: number;
  avgPosition: number | null;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  error?: string;
};
type Review = {
  reviewId: string;
  reviewer: string;
  starRating: number;
  comment: string;
  createTime: string;
  hasReply: boolean;
  replyComment: string | null;
};
type GbpData = {
  averageRating: number | null;
  totalReviewCount: number;
  unreplied: number;
  recent: Review[];
  error?: string;
};

function PostComposer() {
  const [theme, setTheme] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const makeDraft = async () => {
    setBusy(true); setErr(''); setDone(false);
    try {
      const res = await fetch('/api/app/gbp-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) setErr(data?.error || '生成に失敗しました。');
      else setDraft(data.draft);
    } catch { setErr('通信エラーが発生しました。'); }
    setBusy(false);
  };

  const send = async () => {
    if (!draft?.trim()) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/app/gbp-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) setErr(data?.error || '投稿に失敗しました。');
      else { setDone(true); setDraft(null); setTheme(''); }
    } catch { setErr('通信エラーが発生しました。'); }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#eadfe7] p-6 mb-4">
      <p className="text-xs font-black opacity-60 mb-1">GBP投稿を作成</p>
      <p className="text-[10px] font-bold opacity-40 mb-3">定期的な投稿はプロフィールの鮮度シグナルになり、MEO・AIOの両方に効きます。</p>
      {done && <p className="text-xs font-black mb-2" style={{ color: 'var(--opt-accent-dark)' }}>✓ 投稿しました。Googleマップに反映されるまで数分かかることがあります。</p>}
      {draft === null ? (
        <div className="flex gap-2">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="テーマ（空欄なら季節のお役立ち情報をAIが選びます）"
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-xs font-bold"
          />
          <button
            onClick={makeDraft}
            disabled={busy}
            className="shrink-0 flex items-center gap-1.5 text-[11px] font-black px-4 py-2.5 rounded-xl text-white disabled:opacity-40"
            style={{ background: 'var(--opt-accent)' }}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : null} AI投稿案を作成
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-xs font-medium leading-relaxed"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={send}
              disabled={busy || !draft.trim()}
              className="flex items-center gap-1.5 text-[11px] font-black px-3.5 py-1.5 rounded-full text-white disabled:opacity-40"
              style={{ background: 'var(--opt-accent)' }}
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : null} この内容で投稿する
            </button>
            <button onClick={makeDraft} disabled={busy} className="text-[11px] font-bold underline opacity-50 hover:opacity-100">作り直す</button>
            <button onClick={() => setDraft(null)} disabled={busy} className="text-[11px] font-bold underline opacity-50 hover:opacity-100">キャンセル</button>
          </div>
          <p className="text-[10px] font-bold opacity-40">投稿するとGoogleマップ・検索のビジネスプロフィールに公開されます。</p>
        </div>
      )}
      {err && <p className="text-[11px] font-bold text-red-600 mt-1.5">{err}</p>}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const makeDraft = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/app/gbp-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: review.reviewer, starRating: review.starRating, comment: review.comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) setErr(data?.error || '生成に失敗しました。');
      else setDraft(data.draft);
    } catch {
      setErr('通信エラーが発生しました。');
    }
    setBusy(false);
  };

  const send = async () => {
    if (!draft?.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/app/gbp-reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.reviewId, comment: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) setErr(data?.error || '送信に失敗しました。');
      else setSent(true);
    } catch {
      setErr('通信エラーが発生しました。');
    }
    setBusy(false);
  };

  const replied = review.hasReply || sent;

  return (
    <div className="bg-white rounded-3xl border border-[#eadfe7] px-6 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-black">
          {review.reviewer}
          <span className="ml-2" style={{ color: '#e8b931' }}>{'★'.repeat(review.starRating)}</span>
        </p>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${replied ? 'bg-[#eaf6f0] text-[#1a9e6e]' : 'bg-red-50 text-red-600'}`}>
          {replied ? '返信済み' : '未返信'}
        </span>
      </div>
      <p className="text-xs font-medium opacity-60 leading-relaxed">{review.comment || '（コメントなし）'}</p>

      {replied && (review.replyComment || sent) && (
        <p className="text-[11px] font-bold opacity-50 mt-2 pl-3 border-l-2 border-[#e5d5e1]">
          返信: {sent && draft ? draft : review.replyComment}
        </p>
      )}

      {!replied && (
        <div className="mt-3">
          {draft === null ? (
            <button
              onClick={makeDraft}
              disabled={busy}
              className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full text-white disabled:opacity-40"
              style={{ background: 'var(--opt-accent)' }}
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : null} AI返信案を作成
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-xs font-medium leading-relaxed"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={send}
                  disabled={busy || !draft.trim()}
                  className="flex items-center gap-1.5 text-[11px] font-black px-3.5 py-1.5 rounded-full text-white disabled:opacity-40"
                  style={{ background: 'var(--opt-accent)' }}
                >
                  {busy ? <Loader2 size={11} className="animate-spin" /> : null} この内容で返信を送信
                </button>
                <button onClick={makeDraft} disabled={busy} className="text-[11px] font-bold underline opacity-50 hover:opacity-100">
                  作り直す
                </button>
                <button onClick={() => setDraft(null)} disabled={busy} className="text-[11px] font-bold underline opacity-50 hover:opacity-100">
                  キャンセル
                </button>
              </div>
              <p className="text-[10px] font-bold opacity-40">送信するとGoogleマップ上にお店の公式返信として公開されます。内容を確認してから送信してください。</p>
            </div>
          )}
          {err && <p className="text-[11px] font-bold text-red-600 mt-1.5">{err}</p>}
        </div>
      )}
    </div>
  );
}

export default function SeoMeoPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [gsc, setGsc] = useState<GscData | null>(null);
  const [gbp, setGbp] = useState<GbpData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [blogPages, setBlogPages] = useState<BlogPageRow[]>([]);
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
          setArticles(Array.isArray(data.articles) ? data.articles : []);
          setBlogPages(Array.isArray(data.blogPages) ? data.blogPages : []);
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
        {/* Studio送稿記事の効果トラッキング */}
        {articles.length > 0 && (
          <div className="mt-4 bg-white rounded-3xl border border-[#eadfe7] p-6">
            <h3 className="text-xs font-black flex items-center gap-2 mb-1">
              <FileText size={14} style={{ color: 'var(--opt-accent)' }} /> 送稿した記事（Pal Studioブログ）
            </h3>
            <p className="text-[10px] font-bold opacity-40 mb-3">
              記事はStudio側で公開されるとGoogle検索に反映されます。下の実績は送稿日以降のブログ配下ページの合計です（ベストエフォート）。
            </p>
            <ul className="space-y-2 mb-4">
              {articles.map((a) => {
                const ms = new Date(a.sentAt).getTime();
                const day = Number.isFinite(ms)
                  ? new Date(ms + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '/')
                  : '';
                return (
                  <li key={a.id} className="text-xs font-bold flex items-start gap-2">
                    <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: 'var(--opt-accent)' }}>
                      {day}
                    </span>
                    <span>{a.title}</span>
                  </li>
                );
              })}
            </ul>
            {!gsc || gsc.error ? (
              <p className="text-[11px] font-bold opacity-40">
                Search Console連携が有効になると、送稿後のクリック・表示回数がここに表示されます。
              </p>
            ) : blogPages.length === 0 ? (
              <p className="text-[11px] font-bold opacity-40">
                送稿日以降、ブログ配下ページの検索実績はまだ計測されていません（公開・インデックスまで時間がかかります）。
              </p>
            ) : (
              <div>
                <div className="flex items-center gap-6 mb-2">
                  <p className="text-[11px] font-black">
                    ブログ全体の送稿後実績:
                    <span className="ml-2">クリック {blogPages.reduce((a, p) => a + p.clicks, 0)}</span>
                    <span className="ml-3">表示 {blogPages.reduce((a, p) => a + p.impressions, 0)}</span>
                  </p>
                </div>
                <ul className="space-y-1">
                  {blogPages.slice(0, 5).map((p) => (
                    <li key={p.page} className="text-[11px] font-bold flex justify-between gap-3">
                      <span className="truncate opacity-70">{p.page.replace(/^https?:\/\/[^/]+/, '')}</span>
                      <span className="shrink-0 opacity-40">クリック {p.clicks} / 表示 {p.impressions}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
            <PostComposer />
            <div className="space-y-3">
              {[...gbp.recent]
                .sort((a, b) => Number(a.hasReply) - Number(b.hasReply))
                .map((r) => (
                  <ReviewCard key={r.reviewId || r.createTime} review={r} />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
