import { NextRequest, NextResponse } from 'next/server';
import { collectBatch, type CollectResult } from '@/lib/collector';
import { listProjectsNeedingAudit, insertAudit } from '@/lib/db';
import { runAudit } from '@/lib/audit';

/**
 * 計測バッチの実行口。
 * - GET: Vercel Cron から毎日実行（CRON_SECRET が設定されていれば Vercel が
 *   自動で `Authorization: Bearer $CRON_SECRET` を付与する）。時間の許す限りバッチを回す。
 * - POST: 手動/外部cron用。1バッチだけ実行して remaining を返す（呼び出し側でループ）。
 */
export const maxDuration = 300;

const authorized = (req: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && (req.headers.get('authorization') || '') === `Bearer ${secret}`;
};

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const budgetMs = 240_000; // maxDuration=300s に対して余裕を残す
  const totals = { processed: 0, runs: 0, errors: 0 };
  let remaining = -1;

  try {
    do {
      const r: CollectResult = await collectBatch(4);
      totals.processed += r.processed;
      totals.runs += r.runs;
      totals.errors += r.errors;
      remaining = r.remaining;
      if (r.processed === 0) break; // 対象なし（無限ループ防止）
    } while (remaining > 0 && Date.now() - startedAt < budgetMs);

    // 週次のサイト自動診断を相乗り（時間が残っている場合のみ）
    let audits = 0;
    if (Date.now() - startedAt < budgetMs) {
      const stale = await listProjectsNeedingAudit(5);
      for (const project of stale) {
        if (Date.now() - startedAt >= budgetMs) break;
        try {
          const result = await runAudit(project);
          if (!result.error) {
            await insertAudit(project.id, result.score, result.checks, result.fetchedUrl);
            audits += 1;
          }
        } catch {
          /* 個別失敗は無視（翌日再試行） */
        }
      }
    }

    return NextResponse.json({ success: true, ...totals, audits, remaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'collect failed';
    return NextResponse.json({ success: false, ...totals, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const batchSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('batch') || 4), 1), 10);
  try {
    const result = await collectBatch(batchSize);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'collect failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
