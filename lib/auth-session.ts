export type SessionRole = 'admin' | 'customer';

export type SessionPayload = {
  role: SessionRole;
  customerId?: string;
  exp: number;
};

export const SESSION_COOKIE_NAME = 'palette_session';
export const MAIN_SESSION_COOKIE_NAME = 'palette_main_session';

export const createSessionValue = (payload: SessionPayload): string => {
  return encodeURIComponent(JSON.stringify(payload));
};

export const parseSessionValue = (value?: string | null): SessionPayload | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as SessionPayload;
    if (!parsed || !parsed.role || !parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const isExpired = (payload: SessionPayload): boolean => {
  return Date.now() > payload.exp;
};
