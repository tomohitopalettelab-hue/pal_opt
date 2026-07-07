import { cookies } from 'next/headers';
import { SESSION_COOKIE, parseSessionValue } from '@/lib/auth-session';
import { Sparkles, Radar, Stethoscope, Wrench, LogOut } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PILLARS = [
  {
    icon: Radar,
    title: 'AI可視性の観測',
    body: 'ChatGPT・Gemini などのAI検索で、あなたのお店・会社がどう答えられているかを毎日定点観測します。',
  },
  {
    icon: Stethoscope,
    title: 'サイト診断',
    body: 'AIに引用されやすいサイトかを約30項目で自動診断し、AIOスコアとして見える化します。',
  },
  {
    icon: Wrench,
    title: '改善の実装',
    body: '構造化データ・FAQ・GBP運用まで、AIに選ばれるための施策を実装し、効果を数字で検証します。',
  },
];

export default async function MainPage() {
  const cookieStore = await cookies();
  const session = await parseSessionValue(cookieStore.get(SESSION_COOKIE)?.value);
  const displayName = session?.accountName || session?.paletteId || '';

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#eadfe7]">
        <div className="flex items-center gap-2">
          <Sparkles size={20} style={{ color: 'var(--opt-accent)' }} />
          <span className="text-lg font-black tracking-tight">Pal Opt</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--opt-accent)' }}>
            AIO
          </span>
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
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-black mb-3">AI検索最適化ダッシュボード</h1>
          <p className="text-sm font-bold opacity-60 leading-relaxed">
            Pal Opt は生まれ変わりました。AIにあなたのビジネスが
            <br className="hidden sm:block" />
            どう紹介されているかを観測し、「AIに選ばれる状態」を作ります。
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-3xl border border-[#eadfe7] p-6">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--opt-accent-light)' }}
              >
                <Icon size={18} style={{ color: 'var(--opt-accent)' }} />
              </div>
              <h2 className="text-sm font-black mb-2">{title}</h2>
              <p className="text-xs font-bold opacity-60 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div
          className="rounded-3xl border p-8 text-center"
          style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}
        >
          <p className="text-sm font-black mb-1" style={{ color: 'var(--opt-accent-dark)' }}>
            計測の準備を進めています
          </p>
          <p className="text-xs font-bold opacity-60">
            観測プロンプトの初期設定が完了すると、ここにAI可視性スコアが表示されます。
          </p>
        </div>
      </main>
    </div>
  );
}
