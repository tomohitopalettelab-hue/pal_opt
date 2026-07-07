import Link from 'next/link';
import { Sparkles, LogOut } from 'lucide-react';
import { getSession } from '@/lib/session-server';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const displayName = session?.accountName || session?.paletteId || '';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white border-b border-[#eadfe7]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/main" className="flex items-center gap-2">
              <Sparkles size={20} style={{ color: 'var(--opt-accent)' }} />
              <span className="text-lg font-black tracking-tight">Pal Opt</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: 'var(--opt-accent)' }}
              >
                AIO
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-xs font-bold">
              <Link href="/main" className="opacity-70 hover:opacity-100 transition-opacity">
                ダッシュボード
              </Link>
              <Link href="/main/prompts" className="opacity-70 hover:opacity-100 transition-opacity">
                観測プロンプト
              </Link>
              <Link href="/main/logs" className="opacity-70 hover:opacity-100 transition-opacity">
                AI回答ログ
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold opacity-60">{displayName}</span>
            <a
              href="/api/auth/logout"
              className="flex items-center gap-1.5 text-xs font-bold opacity-60 hover:opacity-100 transition-opacity"
            >
              <LogOut size={14} /> ログアウト
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
