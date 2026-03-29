import { palDbGet } from './pal-db-client';

type PalDbAccount = {
  id: string;
  paletteId: string;
  name: string;
  status: string;
  chatLoginId: string | null;
  chatPasswordSet: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ServiceItem = {
  serviceKey: string;
};

const todayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const hasPalOptService = (serviceKeys: string[]): boolean => {
  return serviceKeys.some((key) => key === 'pal_opt');
};

const hasServiceKey = (serviceKeys: string[], target: string): boolean => {
  return serviceKeys.some((key) => key === target);
};

/**
 * pal_opt サービスを購読中の顧客一覧を取得
 * pal_db の service_subscriptions テーブルを参照
 */
export const listPalOptAccountsFromPalDb = async (): Promise<PalDbAccount[]> => {
  const activeOn = todayYmd();
  const [accountsRes, subsRes] = await Promise.all([
    palDbGet('/api/accounts'),
    palDbGet(`/api/service-subscriptions?activeOn=${encodeURIComponent(activeOn)}`),
  ]);

  if (!accountsRes.ok) throw new Error('pal_db の顧客一覧取得に失敗しました');
  if (!subsRes.ok) throw new Error('pal_db のサービス購読一覧取得に失敗しました');

  const accountsBody = await accountsRes.json().catch(() => ({}));
  const subsBody = await subsRes.json().catch(() => ({}));

  const accounts: PalDbAccount[] = Array.isArray(accountsBody?.accounts) ? accountsBody.accounts : [];
  const subscriptions: (ServiceItem & { accountId: string })[] = Array.isArray(subsBody?.subscriptions) ? subsBody.subscriptions : [];

  const palOptAccountIds = new Set(
    subscriptions
      .filter((sub) => sub.serviceKey === 'pal_opt')
      .map((sub) => String(sub.accountId || '').trim())
      .filter(Boolean),
  );

  return accounts.filter((account) => palOptAccountIds.has(String(account.id || '').trim()));
};

export const findPalOptAccountByPaletteId = async (paletteId: string): Promise<PalDbAccount | null> => {
  const target = String(paletteId || '').trim().toUpperCase();
  if (!target) return null;
  const accounts = await listPalOptAccountsFromPalDb();
  return accounts.find((account) => String(account.paletteId || '').trim().toUpperCase() === target) || null;
};

/** palette_id に対して指定サービスの購読があるかチェック */
const hasPaletteService = async (paletteId: string, serviceKey: string): Promise<boolean> => {
  const target = String(paletteId || '').trim();
  if (!target) return false;

  const activeOn = todayYmd();
  const params = new URLSearchParams({ paletteId: target, activeOn });
  const res = await palDbGet(`/api/palette-services?${params.toString()}`);
  if (!res.ok) return false;

  const body = await res.json().catch(() => ({}));
  const serviceKeys: string[] = Array.isArray(body?.serviceKeys) ? body.serviceKeys : [];
  return hasServiceKey(serviceKeys, serviceKey);
};

/** pal_studio サービスを保持しているかチェック */
export const hasPalStudioStandard = async (paletteId: string): Promise<boolean> => {
  return hasPaletteService(paletteId, 'pal_studio');
};

/** pal_opt サービスを保持しているかチェック（ログイン可否判定） */
export const canLoginPalOptByPaletteId = async (paletteId: string): Promise<boolean> => {
  const target = String(paletteId || '').trim();
  if (!target) return false;

  const activeOn = todayYmd();
  const params = new URLSearchParams({ paletteId: target, activeOn });
  const res = await palDbGet(`/api/palette-services?${params.toString()}`);

  if (!res.ok) {
    throw new Error('pal_db のサービス照合に失敗しました');
  }

  const body = await res.json().catch(() => ({}));
  const serviceKeys: string[] = Array.isArray(body?.serviceKeys) ? body.serviceKeys : [];
  return hasPalOptService(serviceKeys);
};
