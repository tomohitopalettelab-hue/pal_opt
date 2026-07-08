import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getLatestAudit, getAuditHistory, insertAudit, type AuditTarget } from '@/lib/db';
import { runAudit } from '@/lib/audit';
import type { AuditCheck } from '@/lib/audit';

export const maxDuration = 60;

const parseTarget = (raw: unknown): AuditTarget => (raw === 'hub' ? 'hub' : 'site');

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const target = parseTarget(req.nextUrl.searchParams.get('target'));
  const [audit, history] = await Promise.all([
    getLatestAudit(project.id, target),
    getAuditHistory(project.id, 12, target),
  ]);
  return NextResponse.json({ success: true, audit, history, target });
}

/** 診断を実行して保存。body: { target?: 'site' | 'hub' } */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { target?: unknown };
  const target = parseTarget(body.target);

  if (target === 'hub' && (!project.hubEnabled || !project.hubUrl)) {
    return NextResponse.json({ success: false, error: 'ハブページが未公開です。先に「ハブページ」から公開してください。' }, { status: 400 });
  }

  // ハブ診断は runAudit にハブURLを渡すだけ（PSI・robots・JSON-LD等の検査はそのまま効く）
  const auditee = target === 'hub' ? { ...project, siteUrl: project.hubUrl } : project;
  const result = await runAudit(auditee);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  const audit = await insertAudit(project.id, result.score, result.checks as unknown as AuditCheck[], result.fetchedUrl, target);
  return NextResponse.json({ success: true, audit, target });
}
