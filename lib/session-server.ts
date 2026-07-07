/**
 * サーバー側(Route Handler / Server Component)でのセッション取得。
 * middlewareで保護済みのパスでも、paletteIdスコープはここから取る（default-deny）。
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, parseSessionValue, isExpired, type SessionPayload } from './auth-session';

export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const payload = await parseSessionValue(store.get(SESSION_COOKIE)?.value);
  if (!payload || isExpired(payload)) return null;
  return payload;
};
