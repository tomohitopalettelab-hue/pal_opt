import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getDailyStats } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: true, stats: [] });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') || 30), 1), 90);
  const stats = await getDailyStats(project.id, days);
  return NextResponse.json({ success: true, stats });
}
