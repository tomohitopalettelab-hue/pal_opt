/**
 * 顧客セッション（HMAC-SHA256署名付きCookie、pal_agencyと同方式）。
 * 旧pal_optの無署名JSON Cookieは廃止。
 */
import { signCookie, verifyCookie } from './cookie-sign';

export type SessionPayload = {
  role: 'customer';
  /** accounts.palette_id（大文字） */
  paletteId: string;
  /** 表示名（accounts.name） */
  accountName?: string;
  exp: number;
};

export const SESSION_COOKIE = 'pal_opt_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const createSessionValue = (payload: SessionPayload): Promise<string> =>
  signCookie(payload);

export const parseSessionValue = (value?: string | null): Promise<SessionPayload | null> =>
  verifyCookie<SessionPayload>(value, (p) => p.role === 'customer' && !!p.paletteId && !!p.exp);

export const isExpired = (payload: SessionPayload): boolean => Date.now() > payload.exp;
