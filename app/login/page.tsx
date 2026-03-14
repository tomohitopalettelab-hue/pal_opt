"use client";

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const next = useMemo(() => searchParams.get('next') || undefined, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', id, password, next }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'ログインに失敗しました。');
        return;
      }
      router.push(data.redirectTo || '/admin');
      router.refresh();
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F0F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#A62183' }}>
            <span className="text-white text-xs font-black">PO</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 leading-none">pal opt</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">運用最適化</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-5">管理者ログイン</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">ID</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #A6218340')}
              onBlur={(e) => (e.target.style.boxShadow = '')}
              placeholder="admin id"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #A6218340')}
              onBlur={(e) => (e.target.style.boxShadow = '')}
              placeholder="password"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: '#A62183' }}
            onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.backgroundColor = '#8a1a6d'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#A62183'; }}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F5F0F4]" />}>
      <LoginPageInner />
    </Suspense>
  );
}
