'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || 'ログインに失敗しました。');
        setLoading(false);
        return;
      }
      router.push('/admin');
    } catch {
      setError('通信エラーが発生しました。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-3xl border border-[#eadfe7] p-8 space-y-5">
        <div className="flex items-center gap-2 justify-center">
          <ShieldCheck size={20} style={{ color: 'var(--opt-accent)' }} />
          <h1 className="text-lg font-black">Pal Opt 管理</h1>
        </div>
        <input
          className="w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="管理者ID"
          autoComplete="username"
        />
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-[#e5d5e1] bg-[#fdfbfd] focus:outline-none focus:border-[var(--opt-accent)] text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
        />
        {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-black disabled:opacity-40"
          style={{ background: 'var(--opt-accent)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          ログイン
        </button>
      </form>
    </div>
  );
}
