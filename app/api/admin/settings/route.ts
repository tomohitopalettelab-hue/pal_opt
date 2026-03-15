import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { getSettingsByPaletteId, upsertSettings } from '../../_lib/pal-opt-store';
import { hasPalStudioStandard } from '../../_lib/pal-opt-accounts';

const isAdmin = async (): Promise<boolean> => {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionValue(value);
  return !!session && session.role === 'admin' && !isExpired(session);
};

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const url = new URL(req.url);
    const paletteId = url.searchParams.get('paletteId') || '';
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です。' }, { status: 400 });
    }

    const [settings, hasPalStudio] = await Promise.all([
      getSettingsByPaletteId(paletteId),
      hasPalStudioStandard(paletteId).catch(() => false),
    ]);
    return NextResponse.json({ success: true, settings, hasPalStudioDetected: hasPalStudio });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '設定の取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const paletteId = String(body.paletteId || '').trim();
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です。' }, { status: 400 });
    }

    const settings = await upsertSettings(paletteId, {
      igAccessToken: body.igAccessToken ?? undefined,
      igBusinessAccountId: body.igBusinessAccountId ?? undefined,
      gbpAccessToken: body.gbpAccessToken ?? undefined,
      gbpRefreshToken: body.gbpRefreshToken ?? undefined,
      gbpLocationId: body.gbpLocationId ?? undefined,
      blogUrl: body.blogUrl ?? undefined,
      blogWpUsername: body.blogWpUsername ?? undefined,
      blogApiKey: body.blogApiKey ?? undefined,
      targetKeywords: Array.isArray(body.targetKeywords) ? body.targetKeywords : undefined,
      goals: body.goals ?? undefined,
      defaultTone: body.defaultTone ?? undefined,
      hasPalStudio: body.hasPalStudio !== undefined ? Boolean(body.hasPalStudio) : undefined,
      hasPalTrust: body.hasPalTrust !== undefined ? Boolean(body.hasPalTrust) : undefined,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '設定の保存に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
