import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * 管理者用: 顧客プロジェクトのリセット（削除）。
 * middleware で /api/admin/* は管理者セッション必須。
 * pal_opt_projects の削除で prompts/runs/audits/actions/notifications/articles はCASCADE削除され、
 * 顧客は次回ログイン時にオンボーディングからやり直しになる（アカウント・契約には影響しない）。
 * ※ db.ts はブラッシュアップ実装と競合しないよう直接SQLを使用。
 */
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { projectId?: number; confirmPaletteId?: string };
  const projectId = Number(body.projectId);
  const confirm = String(body.confirmPaletteId || '').trim().toUpperCase();
  if (!Number.isInteger(projectId) || !confirm) {
    return NextResponse.json({ success: false, error: 'projectId と confirmPaletteId が必要です。' }, { status: 400 });
  }

  const { rows } = await sql`SELECT palette_id FROM pal_opt_projects WHERE id = ${projectId} LIMIT 1`;
  if (!rows.length) {
    return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません。' }, { status: 404 });
  }
  const paletteId = String(rows[0].palette_id).toUpperCase();
  if (paletteId !== confirm) {
    return NextResponse.json(
      { success: false, error: `確認入力が一致しません（対象: ${paletteId}）。` },
      { status: 400 },
    );
  }

  await sql`DELETE FROM pal_opt_projects WHERE id = ${projectId}`;
  return NextResponse.json({ success: true, paletteId });
}
