import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, upsertProject, insertPrompts, listPrompts } from '@/lib/db';
import { suggestPrompts } from '@/lib/suggest-prompts';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  return NextResponse.json({ success: true, project });
}

type ProjectBody = {
  businessName?: string;
  businessAliases?: string[];
  siteUrl?: string;
  industry?: string;
  area?: string;
  competitors?: string[];
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  try {
    const body = (await req.json()) as ProjectBody;
    const businessName = String(body.businessName || '').trim();
    if (!businessName) {
      return NextResponse.json({ success: false, error: '事業者名は必須です。' }, { status: 400 });
    }

    const toList = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [];

    const isNew = !(await getProjectByPaletteId(session.paletteId));
    const project = await upsertProject({
      paletteId: session.paletteId,
      businessName,
      businessAliases: toList(body.businessAliases),
      siteUrl: String(body.siteUrl || '').trim() || null,
      industry: String(body.industry || '').trim() || null,
      area: String(body.area || '').trim() || null,
      competitors: toList(body.competitors),
    });

    // 初回作成時は観測プロンプトを自動提案して登録
    let promptsGenerated = 0;
    if (isNew) {
      const suggested = await suggestPrompts(project, 20).catch(() => []);
      promptsGenerated = await insertPrompts(project.id, suggested);
    }

    const prompts = await listPrompts(project.id);
    return NextResponse.json({ success: true, project, prompts, promptsGenerated });
  } catch (e) {
    const message = e instanceof Error ? e.message : '保存に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
