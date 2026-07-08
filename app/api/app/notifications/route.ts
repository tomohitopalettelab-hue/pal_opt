import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listNotifications, markAllNotificationsRead } from '@/lib/db';

/** GET: 通知一覧＋未読数 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: true, notifications: [], unread: 0 });

  const notifications = await listNotifications(project.id, 30);
  const unread = notifications.filter((n) => !n.readAt).length;
  return NextResponse.json({ success: true, notifications, unread });
}

/** PATCH: 全件既読化 */
export async function PATCH() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return NextResponse.json({ success: true });

  await markAllNotificationsRead(project.id);
  return NextResponse.json({ success: true });
}
