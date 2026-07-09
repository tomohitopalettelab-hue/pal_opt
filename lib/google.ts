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
  reviewId: string;
  reviewer: string;
  starRating: number;
  comment: string;
  createTime: string;
  hasReply: boolean;
  replyComment: string | null;
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
      reviewId?: string;
      reviewer?: { displayName?: string };
      starRating?: string;
      comment?: string;
      createTime?: string;
      reviewReply?: { comment?: string };
    }>;
    averageRating?: number;
    totalReviewCount?: number;
  }>(token, `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`);

  const reviews = (data.reviews ?? []).map((r) => ({
    reviewId: r.reviewId || '',
    reviewer: r.reviewer?.displayName || '匿名',
    starRating: STAR_MAP[r.starRating || ''] ?? 0,
    comment: r.comment || '',
    createTime: r.createTime || '',
    hasReply: Boolean(r.reviewReply),
    replyComment: r.reviewReply?.comment || null,
  }));
  return {
    averageRating: data.averageRating ?? null,
    totalReviewCount: data.totalReviewCount ?? reviews.length,
    unreplied: reviews.filter((r) => !r.hasReply).length,
    recent: reviews.slice(0, 20),
  };
};

export type GbpLocationDetails = {
  title: string;
  /** 例: 03-1234-5678 */
  phone: string;
  postalCode: string;
  /** 都道府県+市区町村+番地を連結した1行住所 */
  address: string;
  /** 例: 月 10:00〜19:00、火 定休 ... の読みやすい文字列 */
  businessHours: string;
  websiteUri: string;
  categories: string[];
  /** GBPプロフィールの「ビジネス情報（説明）」 */
  profileDescription: string;
};

const GBP_DAY_JP: Record<string, string> = {
  MONDAY: '月', TUESDAY: '火', WEDNESDAY: '水', THURSDAY: '木',
  FRIDAY: '金', SATURDAY: '土', SUNDAY: '日',
};

const fmtGbpTime = (t?: { hours?: number; minutes?: number }): string => {
  if (!t || t.hours === undefined) return '';
  return `${t.hours}:${String(t.minutes ?? 0).padStart(2, '0')}`;
};

/**
 * GBPロケーション詳細（Business Information API v1）。
 * 保存形式の locationName は accounts/{a}/locations/{l} なので locations/{l} を抽出して呼ぶ。
 * 取得できない/権限がない場合は null（呼び出し側はHPソースのみで続行）。
 */
export const getGbpLocationDetails = async (
  token: string,
  locationName: string,
): Promise<GbpLocationDetails | null> => {
  const m = String(locationName || '').match(/locations\/[^/]+$/);
  const loc = m ? m[0] : String(locationName || '');
  if (!loc) return null;
  try {
    const data = await gget<{
      title?: string;
      phoneNumbers?: { primaryPhone?: string };
      storefrontAddress?: {
        postalCode?: string;
        administrativeArea?: string;
        locality?: string;
        addressLines?: string[];
      };
      regularHours?: {
        periods?: Array<{
          openDay?: string;
          openTime?: { hours?: number; minutes?: number };
          closeTime?: { hours?: number; minutes?: number };
        }>;
      };
      websiteUri?: string;
      categories?: {
        primaryCategory?: { displayName?: string };
        additionalCategories?: Array<{ displayName?: string }>;
      };
      profile?: { description?: string };
    }>(
      token,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${loc}?readMask=title,phoneNumbers,storefrontAddress,regularHours,websiteUri,categories,profile`,
    );

    const addr = data.storefrontAddress;
    const address = addr
      ? [addr.administrativeArea, addr.locality, ...(addr.addressLines ?? [])]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .join('')
      : '';

    // 曜日順に営業時間を整形（複数区間は / で連結）
    const byDay = new Map<string, string[]>();
    for (const period of data.regularHours?.periods ?? []) {
      const day = String(period.openDay || '');
      if (!GBP_DAY_JP[day]) continue;
      const open = fmtGbpTime(period.openTime);
      const close = fmtGbpTime(period.closeTime);
      if (!open || !close) continue;
      const list = byDay.get(day) ?? [];
      list.push(`${open}〜${close}`);
      byDay.set(day, list);
    }
    const businessHours = Object.keys(GBP_DAY_JP)
      .filter((d) => byDay.has(d))
      .map((d) => `${GBP_DAY_JP[d]} ${(byDay.get(d) ?? []).join(' / ')}`)
      .join('、');

    const categories = [
      data.categories?.primaryCategory?.displayName,
      ...(data.categories?.additionalCategories ?? []).map((c) => c.displayName),
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    return {
      title: String(data.title || '').trim(),
      phone: String(data.phoneNumbers?.primaryPhone || '').trim(),
      postalCode: String(addr?.postalCode || '').trim(),
      address,
      businessHours,
      websiteUri: String(data.websiteUri || '').trim(),
      categories,
      profileDescription: String(data.profile?.description || '').trim(),
    };
  } catch {
    return null;
  }
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

/** 「惜しいクエリ」= 4〜20位で表示がある or 表示多いのにCTRが低いクエリ（SEO改善タスクの材料） */
export const getGscOpportunities = async (
  token: string,
  siteUrl: string,
): Promise<Array<{ query: string; position: number; impressions: number; clicks: number; reason: string }>> => {
  const s = await getGscSummaryRows(token, siteUrl, 28, 100);
  const out: Array<{ query: string; position: number; impressions: number; clicks: number; reason: string }> = [];
  for (const r of s) {
    if (r.position >= 4 && r.position <= 20 && r.impressions >= 10) {
      out.push({ ...r, reason: `平均${r.position}位。1ページ目上位に押し上げる余地あり` });
    } else if (r.position < 4 && r.impressions >= 50 && r.clicks / Math.max(r.impressions, 1) < 0.02) {
      out.push({ ...r, reason: `上位表示なのにCTR${Math.round((r.clicks / r.impressions) * 100)}%。タイトル/説明文の魅力不足` });
    }
    if (out.length >= 5) break;
  }
  return out;
};

const getGscSummaryRows = async (
  token: string,
  siteUrl: string,
  days: number,
  rowLimit: number,
): Promise<GscQueryRow[]> => {
  const data = await getGscSummary(token, siteUrl, days, rowLimit);
  return data.topQueries;
};

export type GscPageRow = { page: string; clicks: number; impressions: number };

/**
 * ページ別の検索実績（searchAnalytics query, dimensions:['page']）。
 * startDate（YYYY-MM-DD）以降の実績を返す。送稿記事の効果トラッキング用。
 */
export const getGscPages = async (token: string, siteUrl: string, startDate: string, rowLimit = 100): Promise<GscPageRow[]> => {
  const end = new Date(Date.now() - 2 * 864e5); // GSCは2日遅れ
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate,
        endDate: end.toISOString().slice(0, 10),
        dimensions: ['page'],
        rowLimit,
      }),
    },
  );
  const data = (await res.json()) as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || `GSC API error (${res.status})`);
  return (data.rows ?? []).map((r) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
  }));
};

export const getGscSummary = async (token: string, siteUrl: string, days = 28, rowLimit = 20): Promise<GscSummary> => {
  const end = new Date(Date.now() - 2 * 864e5); // GSCは2日遅れ
  const start = new Date(end.getTime() - days * 864e5);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit }),
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
