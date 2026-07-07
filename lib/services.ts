import { palDbGet } from './pal-db-client';

/**
 * Pal Opt を利用できるサービスキー。
 * 商品はプロプラン(pal_opt_pro)一本だが、旧キー契約も互換で通す。
 */
const PAL_OPT_SERVICE_KEYS = ['pal_opt_pro', 'pal_opt', 'pal_opt_lite', 'pal_opt_standard'];

const todayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** palette_id が Pal Opt 契約を持つか（crm_contracts 正のserviceKeys照合） */
export const hasPalOptContract = async (paletteId: string): Promise<boolean> => {
  const target = String(paletteId || '').trim();
  if (!target) return false;

  const params = new URLSearchParams({ paletteId: target, activeOn: todayYmd() });
  const res = await palDbGet(`/api/palette-services?${params.toString()}`);
  if (!res.ok) {
    throw new Error('pal_db のサービス照合に失敗しました');
  }

  const body = await res.json().catch(() => ({}));
  const serviceKeys: string[] = Array.isArray(body?.serviceKeys) ? body.serviceKeys : [];
  return serviceKeys.some((key) => PAL_OPT_SERVICE_KEYS.includes(key));
};
