/**
 * Google連携（GBP=MEO / Search Console=SEO）。
 * OAuthクライアントは旧pal_optのGCPクライアントを流用（GOOGLE_CLIENT_ID/SECRET）。
 * リダイレクトURIも旧実装と同じ /api/oauth/gbp/callback を使う（GCP側の登録を変えないため）。
 */

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export const oauthRedirectUri = (): string => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3104';
  return `${appUrl.replace(/\/$/, '')}/api/oauth/gbp/callback`;
};

export const exchangeCode = async (code: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: oauthRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; error_description?: string; error?: string };
  if (!data.access_token) throw new Error(data.error_description || data.error || 'トークン取得に失敗しました');
  return { accessToken: data.access_token, refreshToken: data.refresh_token || '' };
};

export const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!data.access_token) throw new Error(data.error_description || data.error || 'トークン更新に失敗しました（再連携が必要かもしれません）');
  return data.access_token;
};

const gget = async <T>(token: string, url: string): Promise<T> => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Google API error (${res.status})`);
  return data;
};

// ---------- GBP (MEO) ----------

export type GbpLocation = { name: string; title: string };

/** アカウント横断で店舗(ロケーション)一覧。nameは accounts/{a}/locations/{l} 形式で返す */
export const listGbpLocations = async (token: string): Promise<GbpLocation[]> => {
  const accounts = await gget<{ accounts?: Array<{ name: string }> }>(
    token,
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  );
  const out: GbpLocation[] = [];
  for (const acc of accounts.accounts ?? []) {
    const locs = await gget<{ locations?: Array<{ name: string; title?: string }> }>(
      token,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title&pageSize=100`,
    ).catch(() => ({ locations: [] as Array<{ name: string; title?: string }> }));
    for (const loc of locs.locations ?? []) {
      // loc.name は locations/{id} 形式 → v4 reviews用に accounts プレフィックスを付与
      out.push({ name: `${acc.name}/${loc.name}`, title: loc.title || loc.name });
    }
  }
  return out;
};

export type GbpReview = {
  reviewer: string;
  starRating: number;
  comment: string;
  createTime: string;
  hasReply: boolean;
};

export type GbpSummary = {
  averageRating: number | null;
  totalReviewCount: number;
  unreplied: number;
  recent: GbpReview[];
};

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export const getGbpSummary = async (token: string, locationName: string): Promise<GbpSummary> => {
  const data = await gget<{
    reviews?: Array<{
      reviewer?: { displayName?: string };
      starRating?: string;
      comment?: string;
      createTime?: string;
      reviewReply?: unknown;
    }>;
    averageRating?: number;
    totalReviewCount?: number;
  }>(token, `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`);

  const reviews = (data.reviews ?? []).map((r) => ({
    reviewer: r.reviewer?.displayName || '匿名',
    starRating: STAR_MAP[r.starRating || ''] ?? 0,
    comment: r.comment || '',
    createTime: r.createTime || '',
    hasReply: Boolean(r.reviewReply),
  }));
  return {
    averageRating: data.averageRating ?? null,
    totalReviewCount: data.totalReviewCount ?? reviews.length,
    unreplied: reviews.filter((r) => !r.hasReply).length,
    recent: reviews.slice(0, 5),
  };
};

// ---------- Search Console (SEO) ----------

export const listGscSites = async (token: string): Promise<string[]> => {
  const data = await gget<{ siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }>(
    token,
    'https://www.googleapis.com/webmasters/v3/sites',
  );
  return (data.siteEntry ?? [])
    .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
    .map((s) => s.siteUrl);
};

export type GscQueryRow = { query: string; clicks: number; impressions: number; position: number };
export type GscSummary = {
  clicks: number;
  impressions: number;
  avgPosition: number | null;
  topQueries: GscQueryRow[];
};

export const getGscSummary = async (token: string, siteUrl: string, days = 28): Promise<GscSummary> => {
  const end = new Date(Date.now() - 2 * 864e5); // GSCは2日遅れ
  const start = new Date(end.getTime() - days * 864e5);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 20 }),
    },
  );
  const data = (await res.json()) as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; position: number }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || `GSC API error (${res.status})`);

  const rows = data.rows ?? [];
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const avgPosition = rows.length
    ? Math.round((rows.reduce((a, r) => a + r.position * r.impressions, 0) / Math.max(impressions, 1)) * 10) / 10
    : null;
  return {
    clicks,
    impressions,
    avgPosition,
    topQueries: rows.map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
    })),
  };
};
