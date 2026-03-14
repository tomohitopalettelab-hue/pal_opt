import { palDbGet } from './pal-db-client';

type PalDbAccount = {
  id: string;
  paletteId: string;
  name: string;
  status: string;
  chatLoginId: string | null;
  chatPasswordSet: boolean;
  isStandard?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ContractItem = {
  accountId: string;
  planId: string;
};

type PlanItem = {
  id: string;
  code: string;
};

const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const isPalOptPlanCode = (code: string): boolean => {
  const normalized = normalize(code).replace(/-/g, '_');
  return normalized === 'pal_opt_lite' || normalized === 'pal_opt_standard';
};

const isPalOptStandardPlanCode = (code: string): boolean => {
  const normalized = normalize(code).replace(/-/g, '_');
  return normalized === 'pal_opt_standard';
};

const todayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const listPalOptAccountsFromPalDb = async (): Promise<PalDbAccount[]> => {
  const activeOn = todayYmd();
  const [accountsRes, contractsRes, plansRes] = await Promise.all([
    palDbGet('/api/accounts'),
    palDbGet(`/api/contracts?activeOn=${encodeURIComponent(activeOn)}`),
    palDbGet('/api/plans?includeInactive=1'),
  ]);

  if (!accountsRes.ok) throw new Error('pal_db の顧客一覧取得に失敗しました');
  if (!contractsRes.ok) throw new Error('pal_db の契約一覧取得に失敗しました');
  if (!plansRes.ok) throw new Error('pal_db のプラン一覧取得に失敗しました');

  const accountsBody = await accountsRes.json().catch(() => ({}));
  const contractsBody = await contractsRes.json().catch(() => ({}));
  const plansBody = await plansRes.json().catch(() => ({}));

  const accounts: PalDbAccount[] = Array.isArray(accountsBody?.accounts) ? accountsBody.accounts : [];
  const contracts: ContractItem[] = Array.isArray(contractsBody?.contracts) ? contractsBody.contracts : [];
  const plans: PlanItem[] = Array.isArray(plansBody?.plans) ? plansBody.plans : [];

  const targetPlanIds = new Set(
    plans
      .filter((plan) => isPalOptPlanCode(plan.code))
      .map((plan) => String(plan.id || '').trim())
      .filter(Boolean),
  );

  const targetAccountIds = new Set(
    contracts
      .filter((item) => targetPlanIds.has(String(item.planId || '').trim()))
      .map((item) => String(item.accountId || '').trim())
      .filter(Boolean),
  );

  const standardPlanIds = new Set(
    plans
      .filter((plan) => isPalOptStandardPlanCode(plan.code))
      .map((plan) => String(plan.id || '').trim())
      .filter(Boolean),
  );

  const accountPlanMap = new Map<string, Set<string>>();
  contracts.forEach((item) => {
    const accountId = String(item.accountId || '').trim();
    const planId = String(item.planId || '').trim();
    if (!accountId || !planId) return;
    const current = accountPlanMap.get(accountId) || new Set<string>();
    current.add(planId);
    accountPlanMap.set(accountId, current);
  });

  return accounts
    .filter((account) => targetAccountIds.has(String(account.id || '').trim()))
    .map((account) => {
      const accountId = String(account.id || '').trim();
      const plansForAccount = accountPlanMap.get(accountId) || new Set<string>();
      const isStandard = Array.from(plansForAccount).some((planId) => standardPlanIds.has(planId));
      return { ...account, isStandard };
    });
};

export const findPalOptAccountByPaletteId = async (paletteId: string): Promise<PalDbAccount | null> => {
  const target = String(paletteId || '').trim().toUpperCase();
  if (!target) return null;
  const accounts = await listPalOptAccountsFromPalDb();
  return accounts.find((account) => String(account.paletteId || '').trim().toUpperCase() === target) || null;
};

export const canLoginPalOptByPaletteId = async (paletteId: string): Promise<boolean> => {
  const target = String(paletteId || '').trim().toUpperCase();
  if (!target) return false;

  const activeOn = todayYmd();
  const [accountsRes, contractsRes, plansRes] = await Promise.all([
    palDbGet('/api/accounts'),
    palDbGet(`/api/contracts?activeOn=${encodeURIComponent(activeOn)}`),
    palDbGet('/api/plans?includeInactive=1'),
  ]);

  if (!accountsRes.ok || !contractsRes.ok || !plansRes.ok) {
    throw new Error('pal_db のプラン照合に失敗しました');
  }

  const accountsBody = await accountsRes.json().catch(() => ({}));
  const contractsBody = await contractsRes.json().catch(() => ({}));
  const plansBody = await plansRes.json().catch(() => ({}));

  const accounts: PalDbAccount[] = Array.isArray(accountsBody?.accounts) ? accountsBody.accounts : [];
  const contracts: ContractItem[] = Array.isArray(contractsBody?.contracts) ? contractsBody.contracts : [];
  const plans: PlanItem[] = Array.isArray(plansBody?.plans) ? plansBody.plans : [];

  const account = accounts.find((item) => String(item.paletteId || '').trim().toUpperCase() === target);
  if (!account) return false;

  const optPlanIds = new Set(
    plans
      .filter((plan) => isPalOptPlanCode(plan.code))
      .map((plan) => String(plan.id || '').trim())
      .filter(Boolean),
  );

  return contracts.some((item) => {
    const accountId = String(item.accountId || '').trim();
    const planId = String(item.planId || '').trim();
    return accountId === String(account.id || '').trim() && optPlanIds.has(planId);
  });
};
