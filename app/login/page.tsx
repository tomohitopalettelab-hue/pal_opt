'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || 'ログインに失敗しました。');
        setLoading(false);
        return;
      }
      router.push('/main');
    } catch {
      setError('通信エラーが発生しました。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="Pal Opt" width={40} height={40} />
            <h1 className="text-3xl font-black tracking-tight">Pal Opt</h1>
          </div>
          <p className="text-sm font-bold opacity-60">AI検索最適化 — AIO × SEO × MEO</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-[#eadfe7] shadow-sm p-8 space-y-5"
        >
          <div>
            <label className="block text-xs font-bold opacity-60 mb-1.5">ログインID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-sm"
              placeholder="ログインID"
            />
          </div>
          <div>
            <label className="block text-xs font-bold opacity-60 mb-1.5">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-sm"
              placeholder="パスワード"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !id || !password}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-black transition-opacity disabled:opacity-40"
            style={{ background: 'var(--opt-accent)' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-[11px] font-bold opacity-40 mt-6">
          Palette Lab — Pal Opt
        </p>
      </div>
    </div>
  );
}
