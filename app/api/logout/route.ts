import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, MAIN_SESSION_COOKIE_NAME } from '../../../lib/auth-session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
  res.cookies.set({ name: MAIN_SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
  return res;
}
