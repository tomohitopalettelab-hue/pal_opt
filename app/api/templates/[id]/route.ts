import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { getTemplateById, upsertTemplate, deleteTemplate } from '../../_lib/pal-opt-store';

const getSession = async () => {
  const store = await cookies();
  const mainVal = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
  const adminVal = store.get(SESSION_COOKIE_NAME)?.value;
  const main = parseSessionValue(mainVal);
  const admin = parseSessionValue(adminVal);
  if (main && !isExpired(main)) return main;
  if (admin && !isExpired(admin)) return admin;
  return null;
};

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/templates/:id — テンプレート詳細 */
export async function GET(_req: Request, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const { id } = await context.params;
    const template = await getTemplateById(id);
    if (!template) {
      return NextResponse.json({ success: false, error: 'テンプレートが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'テンプレートの取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PUT /api/templates/:id — テンプレート更新 */
export async function PUT(req: Request, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await getTemplateById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'テンプレートが見つかりません。' }, { status: 404 });
    }

    // システムテンプレートは管理者のみ編集可
    if (existing.isSystem && session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'システムテンプレートは管理者のみ編集できます。' }, { status: 403 });
    }

    const body = await req.json();
    const template = await upsertTemplate({
      id,
      paletteId: existing.paletteId,
      name: body.name || existing.name,
      category: body.category !== undefined ? body.category : existing.category,
      topic: body.topic !== undefined ? body.topic : existing.topic,
      tone: body.tone !== undefined ? body.tone : existing.tone,
      contentTemplate: body.contentTemplate !== undefined ? body.contentTemplate : existing.contentTemplate,
      isSystem: existing.isSystem,
    });

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'テンプレートの更新に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE /api/templates/:id — テンプレート削除（システムテンプレートは削除不可） */
export async function DELETE(_req: Request, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await getTemplateById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'テンプレートが見つかりません。' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json({ success: false, error: 'システムテンプレートは削除できません。' }, { status: 403 });
    }

    await deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'テンプレートの削除に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
