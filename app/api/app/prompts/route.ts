import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listPrompts, setPromptActive, insertPrompts } from '@/lib/db';
import { suggestPrompts } from '@/lib/suggest-prompts';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const prompts = await listPrompts(project.id);
  return NextResponse.json({ success: true, prompts });
}

/** { promptId, active } のトグル */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { promptId?: number; active?: boolean };
  const promptId = Number(body.promptId);
  if (!Number.isInteger(promptId)) {
    return NextResponse.json({ success: false, error: 'promptId が不正です。' }, { status: 400 });
  }
  await setPromptActive(project.id, promptId, Boolean(body.active));
  return NextResponse.json({ success: true });
}

/** 追加提案の生成 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクト未作成です。' }, { status: 404 });

  const suggested = await suggestPrompts(project, 10).catch(() => []);
  const inserted = await insertPrompts(project.id, suggested);
  const prompts = await listPrompts(project.id);
  return NextResponse.json({ success: true, inserted, prompts });
}
