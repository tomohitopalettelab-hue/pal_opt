import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getLatestAudit, getAuditHistory, insertAudit } from '@/lib/db';
import { runAudit } from '@/lib/audit';
import type { AuditCheck } from '@/lib/audit';

export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const [audit, history] = await Promise.all([getLatestAudit(project.id), getAuditHistory(project.id)]);
  return NextResponse.json({ success: true, audit, history });
}

/** 診断を実行して保存 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const result = await runAudit(project);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  const audit = await insertAudit(project.id, result.score, result.checks as unknown as AuditCheck[], result.fetchedUrl);
  return NextResponse.json({ success: true, audit });
}
