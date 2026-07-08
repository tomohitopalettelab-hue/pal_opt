import { listAllProjectStats } from '@/lib/db';
import { ShieldCheck } from 'lucide-react';
import ResetButton from './ResetButton';

export const dynamic = 'force-dynamic';

const pct = (num: number, den: number): string => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—');

export default async function AdminPage() {
  const stats = await listAllProjectStats();
  const totalRuns = stats.reduce((a, s) => a + s.runs7d, 0);
  const totalErrors = stats.reduce((a, s) => a + s.errors7d, 0);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-[#eadfe7] px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: 'var(--opt-accent)' }} />
          <span className="text-lg font-black">Pal Opt 管理</span>
          <span className="text-xs font-bold opacity-40 ml-4">
            直近7日: 計測 {totalRuns}件 / エラー {totalErrors}件
          </span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-xl font-black mb-6">顧客プロジェクト（{stats.length}件）</h1>
        {stats.length === 0 ? (
          <p className="text-sm font-bold opacity-40">プロジェクトがありません。</p>
        ) : (
          <div className="bg-white rounded-3xl border border-[#eadfe7] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-black opacity-50 border-b border-[#f2ecf1]">
                  <th className="px-5 py-3">palette_id</th>
                  <th className="px-5 py-3">事業者</th>
                  <th className="px-5 py-3">観測中</th>
                  <th className="px-5 py-3">計測(7日)</th>
                  <th className="px-5 py-3">言及率(7日)</th>
                  <th className="px-5 py-3">エラー(7日)</th>
                  <th className="px-5 py-3">AIOスコア</th>
                  <th className="px-5 py-3">最終計測</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.projectId} className="border-b border-[#f7f2f6] font-bold">
                    <td className="px-5 py-3 font-black">{s.paletteId}</td>
                    <td className="px-5 py-3">{s.businessName}</td>
                    <td className="px-5 py-3">{s.activePrompts}問</td>
                    <td className="px-5 py-3">{s.runs7d}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--opt-accent-dark)' }}>
                      {pct(s.mentioned7d, s.runs7d - s.errors7d)}
                    </td>
                    <td className={`px-5 py-3 ${s.errors7d > 0 ? 'text-red-600' : 'opacity-40'}`}>{s.errors7d}</td>
                    <td className="px-5 py-3">{s.auditScore ?? '—'}</td>
                    <td className="px-5 py-3 text-[11px] opacity-60">
                      {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未計測'}
                    </td>
                    <td className="px-5 py-3">
                      <ResetButton projectId={s.projectId} paletteId={s.paletteId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] font-bold opacity-40 mt-4">
          エラーが継続する場合はGeminiの無料枠上限（429）の可能性が高いです。AI Studioで課金を有効化すると接地検索1,500件/日まで無料になります。
        </p>
      </main>
    </div>
  );
}
