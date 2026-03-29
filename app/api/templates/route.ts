import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { listTemplates, upsertTemplate } from '../_lib/pal-opt-store';

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

/** GET /api/templates?paletteId=xxx — テンプレート一覧（顧客のテンプレート + システムテンプレート） */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const url = new URL(req.url);
    const paletteId = url.searchParams.get('paletteId')?.trim() || session.customerId || '';

    const templates = await listTemplates(paletteId || undefined);
    return NextResponse.json({ success: true, templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'テンプレート一覧の取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST /api/templates — テンプレート作成 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'テンプレート名は必須です。' }, { status: 400 });
    }

    const paletteId = body.paletteId || session.customerId || null;

    const template = await upsertTemplate({
      paletteId,
      name,
      category: body.category || null,
      topic: body.topic || null,
      tone: body.tone || null,
      contentTemplate: body.contentTemplate || {},
      isSystem: session.role === 'admin' ? Boolean(body.isSystem) : false,
    });

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'テンプレートの作成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
