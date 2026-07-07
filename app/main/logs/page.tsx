import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listRuns } from '@/lib/db';
import { ENGINE_LABELS, type Engine } from '@/lib/engines';
import { ExternalLink } from 'lucide-react';
import Onboarding from '../Onboarding';

export const dynamic = 'force-dynamic';

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '好意的',
  neutral: '中立',
  negative: '否定的',
};

export default async function LogsPage() {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const runs = await listRuns(project.id, { limit: 50 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black">AI回答ログ</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          AIが実際にどう答えたかの原文です。「AIがあなたのビジネスをどう説明しているか」をここで確認できます。
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-3xl border p-10 text-center" style={{ background: 'var(--opt-accent-light)', borderColor: '#e5c7db' }}>
          <p className="text-sm font-black" style={{ color: 'var(--opt-accent-dark)' }}>
            まだ計測データがありません。初回計測は本日深夜に自動実行されます。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <details key={run.id} className="bg-white rounded-3xl border border-[#eadfe7] px-6 py-4 group">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black truncate">Q. {run.promptText}</p>
                  <p className="text-[10px] font-bold opacity-40 mt-1">
                    {new Date(run.executedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ・{' '}
                    {ENGINE_LABELS[run.engine as Engine] ?? run.engine}
                    {run.sentiment ? ` ・ トーン: ${SENTIMENT_LABEL[run.sentiment] ?? run.sentiment}` : ''}
                    {run.competitorsMentioned.length > 0 ? ` ・ 競合言及: ${run.competitorsMentioned.join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {run.cited && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border" style={{ color: 'var(--opt-accent-dark)', borderColor: 'var(--opt-accent)' }}>
                      自社サイト引用
                    </span>
                  )}
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                    style={{ background: run.mentioned ? 'var(--opt-accent)' : '#b9aab5' }}
                  >
                    {run.mentioned ? `言及あり${run.mentionPosition ? ` (${run.mentionPosition}位)` : ''}` : '言及なし'}
                  </span>
                </div>
              </summary>
              <div className="mt-4 pt-4 border-t border-[#f2ecf1]">
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap opacity-80">
                  {run.answerText || (run.error ? `（計測エラー: ${run.error}）` : '（回答なし）')}
                </p>
                {run.citations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black opacity-40 mb-1.5">AIが参照した情報源</p>
                    <div className="flex flex-wrap gap-2">
                      {run.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f2ecf1] hover:bg-[#e9dfe7]"
                        >
                          <ExternalLink size={10} /> {c.title || c.uri.slice(0, 40)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
