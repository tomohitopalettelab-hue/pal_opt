/**
 * 管理者セッション（顧客セッションとは別Cookie・同じHMAC署名方式）。
 * 認証は環境変数 ADMIN_USERNAME / ADMIN_PASSWORD（旧pal_optから継続のVercel env）。
 */
import { signCookie, verifyCookie } from './cookie-sign';

export type AdminPayload = {
  role: 'admin';
  exp: number;
};

export const ADMIN_COOKIE = 'pal_opt_admin';
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export const createAdminValue = (): Promise<string> =>
  signCookie({ role: 'admin', exp: Date.now() + ADMIN_TTL_MS } satisfies AdminPayload);

export const parseAdminValue = (value?: string | null): Promise<AdminPayload | null> =>
  verifyCookie<AdminPayload>(value, (p) => p.role === 'admin' && !!p.exp);

export const isAdminExpired = (payload: AdminPayload): boolean => Date.now() > payload.exp;
