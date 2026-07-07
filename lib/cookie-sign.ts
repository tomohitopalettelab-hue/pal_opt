// 署名付きCookie値の共通ヘルパー（HMAC-SHA256）。
// middleware(Edge)でも動くよう Web Crypto(crypto.subtle) を使用＝async。
// 形式: `<base64url(json)>.<base64url(hmac)>`。SESSION_SECRET 必須・未設定時 verify は null。
const _encoder = new TextEncoder();

const _getSecret = (): string => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not configured');
  return s;
};

const _toB64Url = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const _fromB64Url = (str: string): Uint8Array => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') +
    (str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4)));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

let _keyPromise: Promise<CryptoKey> | null = null;
const _getKey = (): Promise<CryptoKey> => {
  if (!_keyPromise) {
    _keyPromise = crypto.subtle.importKey(
      'raw', _encoder.encode(_getSecret()),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
  }
  return _keyPromise;
};

const _sign = async (data: string): Promise<string> => {
  const sig = await crypto.subtle.sign('HMAC', await _getKey(), _encoder.encode(data));
  return _toB64Url(new Uint8Array(sig));
};

/** タイミング攻撃耐性のある文字列比較 */
const _safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

export const signCookie = async (payload: unknown): Promise<string> => {
  const data = _toB64Url(_encoder.encode(JSON.stringify(payload)));
  return `${data}.${await _sign(data)}`;
};

export const verifyCookie = async <T>(
  value: string | null | undefined,
  validate: (p: T) => boolean,
): Promise<T | null> => {
  if (!value) return null;
  try {
    const dot = value.lastIndexOf('.');
    if (dot <= 0) return null;
    const data = value.slice(0, dot);
    const sig = value.slice(dot + 1);
    if (!_safeEqual(sig, await _sign(data))) return null;
    const parsed = JSON.parse(new TextDecoder().decode(_fromB64Url(data))) as T;
    if (!parsed || !validate(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};
