import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listRuns } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: true, runs: [] });

  const sp = req.nextUrl.searchParams;
  const runs = await listRuns(project.id, {
    limit: Number(sp.get('limit') || 50),
    engine: sp.get('engine') || undefined,
    mentionedOnly: sp.get('mentioned') === 'true',
  });
  return NextResponse.json({ success: true, runs });
}
