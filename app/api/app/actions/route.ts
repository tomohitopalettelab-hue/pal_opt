import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import {
  getProjectByPaletteId,
  getLatestAudit,
  insertAudit,
  listActions,
  insertActions,
  setActionStatus,
  listMissedPrompts,
} from '@/lib/db';
import { runAudit, type AuditCheck } from '@/lib/audit';
import { generateActions } from '@/lib/actions-gen';

export const maxDuration = 120;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const actions = await listActions(project.id);
  return NextResponse.json({ success: true, actions });
}

/** 最新診断＋計測結果から改善タスクを生成 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  // 診断が無い/古い場合はその場で実行
  let audit = await getLatestAudit(project.id);
  if (!audit || Date.now() - new Date(audit.runAt).getTime() > 7 * 864e5) {
    const result = await runAudit(project);
    if (!result.error) {
      audit = await insertAudit(project.id, result.score, result.checks as unknown as AuditCheck[], result.fetchedUrl);
    }
  }

  const missed = await listMissedPrompts(project.id);
  const generated = await generateActions(project, (audit?.checks ?? []) as AuditCheck[], missed);
  const inserted = await insertActions(project.id, generated);
  const actions = await listActions(project.id);
  return NextResponse.json({ success: true, inserted, actions });
}

/** { actionId, status } の更新（done=実装済み / dismissed=却下 / open=戻す） */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { actionId?: number; status?: string };
  const actionId = Number(body.actionId);
  const status = String(body.status);
  if (!Number.isInteger(actionId) || !['open', 'done', 'dismissed'].includes(status)) {
    return NextResponse.json({ success: false, error: 'パラメータが不正です。' }, { status: 400 });
  }
  await setActionStatus(project.id, actionId, status as 'open' | 'done' | 'dismissed');
  return NextResponse.json({ success: true });
}
