import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { listPalOptAccountsFromPalDb } from '../../_lib/pal-opt-accounts';

export async function GET() {
  try {
    const store = await cookies();
    const value = store.get(SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);

    if (!session || session.role !== 'admin' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const accounts = await listPalOptAccountsFromPalDb();
    return NextResponse.json({ success: true, accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '顧客一覧の取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
