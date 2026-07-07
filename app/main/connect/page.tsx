'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Link2, CircleCheck } from 'lucide-react';

type Status = {
  connected: boolean;
  gbpLocation?: string | null;
  gscSite?: string | null;
  locations?: Array<{ name: string; title: string }>;
  sites?: string[];
  error?: string;
};

function ConnectInner() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch('/api/app/google');
    const data = await res.json().catch(() => ({}));
    setStatus(data?.success ? data : { connected: false, error: data?.error });
  };
  useEffect(() => { load(); }, []);

  const select = async (patch: { gbpLocation?: string; gscSite?: string }) => {
    setSaving(true);
    await fetch('/api/app/google', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
    setSaving(false);
  };

  const selectCls =
    'w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-white focus:outline-none focus:border-[var(--opt-accent)] text-sm font-bold';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-black">Google連携（SEO / MEO）</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          Googleビジネスプロフィール（口コミ・MEO）とSearch Console（SEO実測データ）を接続します。
        </p>
      </div>

      {oauthError && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{oauthError}</p>}

      {!status ? (
        <Loader2 size={20} className="animate-spin opacity-40" />
      ) : !status.connected ? (
        <div className="bg-white rounded-3xl border border-[#eadfe7] p-8 text-center">
          <p className="text-sm font-bold opacity-60 mb-5 leading-relaxed">
            お店のGoogleアカウント（ビジネスプロフィールのオーナー/管理者）で接続してください。
            <br />読み取り中心の権限で、投稿や削除は行いません。
          </p>
          <a
            href="/api/oauth/gbp"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-black text-white"
            style={{ background: 'var(--opt-accent)' }}
          >
            <Link2 size={15} /> Googleアカウントを接続
          </a>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm font-black" style={{ color: 'var(--opt-accent-dark)' }}>
            <CircleCheck size={16} /> Google連携済み
          </div>
          {status.error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {status.error}（権限不足の場合は再接続してください）
            </p>
          )}

          <div className="bg-white rounded-3xl border border-[#eadfe7] p-6 space-y-2">
            <p className="text-xs font-black opacity-60">ビジネスプロフィール（MEO対象の店舗）</p>
            <select
              className={selectCls}
              value={status.gbpLocation ?? ''}
              disabled={saving}
              onChange={(e) => select({ gbpLocation: e.target.value })}
            >
              <option value="">未選択</option>
              {(status.locations ?? []).map((l) => (
                <option key={l.name} value={l.name}>{l.title}</option>
              ))}
            </select>
            {(status.locations ?? []).length === 0 && (
              <p className="text-[11px] font-bold opacity-40">
                店舗が見つかりません。接続したGoogleアカウントがビジネスプロフィールの管理者か確認してください。
              </p>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-[#eadfe7] p-6 space-y-2">
            <p className="text-xs font-black opacity-60">Search Console（SEO対象のサイト）</p>
            <select
              className={selectCls}
              value={status.gscSite ?? ''}
              disabled={saving}
              onChange={(e) => select({ gscSite: e.target.value })}
            >
              <option value="">未選択</option>
              {(status.sites ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <a href="/main/seo" className="text-xs font-black underline" style={{ color: 'var(--opt-accent-dark)' }}>
              SEO / MEO データを見る →
            </a>
            <div className="flex items-center gap-4">
              <a href="/api/oauth/gbp" className="text-xs font-bold underline opacity-50 hover:opacity-100">再接続</a>
              <button
                onClick={async () => { await fetch('/api/app/google', { method: 'DELETE' }); await load(); }}
                className="text-xs font-bold underline opacity-50 hover:opacity-100"
              >
                連携解除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<Loader2 size={20} className="animate-spin opacity-40" />}>
      <ConnectInner />
    </Suspense>
  );
}
