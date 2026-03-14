import { sql } from '@vercel/postgres';
import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PalOptSettings = {
  id: string;
  paletteId: string;
  igAccessToken: string | null;
  igBusinessAccountId: string | null;
  gbpAccessToken: string | null;
  gbpRefreshToken: string | null;
  gbpLocationId: string | null;
  blogUrl: string | null;
  blogWpUsername: string | null;
  blogApiKey: string | null;
  targetKeywords: string[];
  goals: string | null;
  defaultTone: string;
  hasPalStudio: boolean;
  hasPalTrust: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PalOptPost = {
  id: string;
  paletteId: string;
  title: string;
  topic: string;
  keywords: string[];
  targetAudience: string | null;
  imageUrls: string[];
  status: 'draft' | 'preview' | 'approved' | 'published' | 'failed';
  instagramCaption: string | null;
  instagramImageUrl: string | null;
  instagramPostId: string | null;
  blogTitle: string | null;
  blogBodyHtml: string | null;
  blogSlug: string | null;
  blogPostId: string | null;
  gbpSummary: string | null;
  gbpCallToAction: string | null;
  gbpPostId: string | null;
  publishedPlatforms: string[];
  errorLog: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Ensure Tables ─────────────────────────────────────────────────────────────

export const ensurePalOptTables = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS pal_opt_settings (
      id                      TEXT PRIMARY KEY,
      palette_id              TEXT NOT NULL UNIQUE,
      ig_access_token         TEXT,
      ig_business_account_id  TEXT,
      gbp_access_token        TEXT,
      gbp_refresh_token       TEXT,
      gbp_location_id         TEXT,
      blog_url                TEXT,
      blog_wp_username        TEXT,
      blog_api_key            TEXT,
      target_keywords         JSONB NOT NULL DEFAULT '[]',
      goals                   TEXT,
      default_tone            TEXT NOT NULL DEFAULT 'professional',
      has_pal_studio          BOOLEAN NOT NULL DEFAULT FALSE,
      has_pal_trust           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pal_opt_posts (
      id                  TEXT PRIMARY KEY,
      palette_id          TEXT NOT NULL,
      title               TEXT NOT NULL DEFAULT '',
      topic               TEXT NOT NULL DEFAULT '',
      keywords            JSONB NOT NULL DEFAULT '[]',
      target_audience     TEXT,
      image_urls          JSONB NOT NULL DEFAULT '[]',
      status              TEXT NOT NULL DEFAULT 'draft',
      instagram_caption   TEXT,
      instagram_image_url TEXT,
      instagram_post_id   TEXT,
      blog_title          TEXT,
      blog_body_html      TEXT,
      blog_slug           TEXT,
      blog_post_id        TEXT,
      gbp_summary         TEXT,
      gbp_call_to_action  TEXT,
      gbp_post_id         TEXT,
      published_platforms JSONB NOT NULL DEFAULT '[]',
      error_log           TEXT,
      approved_at         TIMESTAMPTZ,
      published_at        TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS pal_opt_posts_palette_id_idx ON pal_opt_posts (palette_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS pal_opt_posts_status_idx ON pal_opt_posts (status)
  `;
};

// ── Settings ──────────────────────────────────────────────────────────────────

const rowToSettings = (row: Record<string, unknown>): PalOptSettings => ({
  id: String(row.id || ''),
  paletteId: String(row.palette_id || ''),
  igAccessToken: (row.ig_access_token as string) || null,
  igBusinessAccountId: (row.ig_business_account_id as string) || null,
  gbpAccessToken: (row.gbp_access_token as string) || null,
  gbpRefreshToken: (row.gbp_refresh_token as string) || null,
  gbpLocationId: (row.gbp_location_id as string) || null,
  blogUrl: (row.blog_url as string) || null,
  blogWpUsername: (row.blog_wp_username as string) || null,
  blogApiKey: (row.blog_api_key as string) || null,
  targetKeywords: Array.isArray(row.target_keywords) ? (row.target_keywords as string[]) : [],
  goals: (row.goals as string) || null,
  defaultTone: String(row.default_tone || 'professional'),
  hasPalStudio: Boolean(row.has_pal_studio),
  hasPalTrust: Boolean(row.has_pal_trust),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

export const getSettingsByPaletteId = async (paletteId: string): Promise<PalOptSettings | null> => {
  await ensurePalOptTables();
  const pid = String(paletteId || '').trim().toUpperCase();
  const { rows } = await sql`SELECT * FROM pal_opt_settings WHERE palette_id = ${pid} LIMIT 1`;
  return rows.length > 0 ? rowToSettings(rows[0]) : null;
};

export const upsertSettings = async (paletteId: string, data: Partial<Omit<PalOptSettings, 'id' | 'paletteId' | 'createdAt' | 'updatedAt'>>): Promise<PalOptSettings> => {
  await ensurePalOptTables();
  const pid = String(paletteId || '').trim().toUpperCase();
  const existing = await getSettingsByPaletteId(pid);
  const id = existing?.id || randomUUID();

  const igAccessToken = data.igAccessToken !== undefined ? data.igAccessToken : (existing?.igAccessToken ?? null);
  const igBusinessAccountId = data.igBusinessAccountId !== undefined ? data.igBusinessAccountId : (existing?.igBusinessAccountId ?? null);
  const gbpAccessToken = data.gbpAccessToken !== undefined ? data.gbpAccessToken : (existing?.gbpAccessToken ?? null);
  const gbpRefreshToken = data.gbpRefreshToken !== undefined ? data.gbpRefreshToken : (existing?.gbpRefreshToken ?? null);
  const gbpLocationId = data.gbpLocationId !== undefined ? data.gbpLocationId : (existing?.gbpLocationId ?? null);
  const blogUrl = data.blogUrl !== undefined ? data.blogUrl : (existing?.blogUrl ?? null);
  const blogWpUsername = data.blogWpUsername !== undefined ? data.blogWpUsername : (existing?.blogWpUsername ?? null);
  const blogApiKey = data.blogApiKey !== undefined ? data.blogApiKey : (existing?.blogApiKey ?? null);
  const targetKeywords = data.targetKeywords !== undefined ? data.targetKeywords : (existing?.targetKeywords ?? []);
  const goals = data.goals !== undefined ? data.goals : (existing?.goals ?? null);
  const defaultTone = data.defaultTone !== undefined ? data.defaultTone : (existing?.defaultTone ?? 'professional');
  const hasPalStudio = data.hasPalStudio !== undefined ? data.hasPalStudio : (existing?.hasPalStudio ?? false);
  const hasPalTrust = data.hasPalTrust !== undefined ? data.hasPalTrust : (existing?.hasPalTrust ?? false);

  const keywordsJson = JSON.stringify(targetKeywords);

  await sql`
    INSERT INTO pal_opt_settings (
      id, palette_id, ig_access_token, ig_business_account_id,
      gbp_access_token, gbp_refresh_token, gbp_location_id,
      blog_url, blog_wp_username, blog_api_key,
      target_keywords, goals, default_tone, has_pal_studio, has_pal_trust
    ) VALUES (
      ${id}, ${pid}, ${igAccessToken}, ${igBusinessAccountId},
      ${gbpAccessToken}, ${gbpRefreshToken}, ${gbpLocationId},
      ${blogUrl}, ${blogWpUsername}, ${blogApiKey},
      ${keywordsJson}::jsonb, ${goals}, ${defaultTone}, ${hasPalStudio}, ${hasPalTrust}
    )
    ON CONFLICT (palette_id) DO UPDATE SET
      ig_access_token         = EXCLUDED.ig_access_token,
      ig_business_account_id  = EXCLUDED.ig_business_account_id,
      gbp_access_token        = EXCLUDED.gbp_access_token,
      gbp_refresh_token       = EXCLUDED.gbp_refresh_token,
      gbp_location_id         = EXCLUDED.gbp_location_id,
      blog_url                = EXCLUDED.blog_url,
      blog_wp_username        = EXCLUDED.blog_wp_username,
      blog_api_key            = EXCLUDED.blog_api_key,
      target_keywords         = EXCLUDED.target_keywords,
      goals                   = EXCLUDED.goals,
      default_tone            = EXCLUDED.default_tone,
      has_pal_studio          = EXCLUDED.has_pal_studio,
      has_pal_trust           = EXCLUDED.has_pal_trust,
      updated_at              = NOW()
  `;

  const result = await getSettingsByPaletteId(pid);
  return result!;
};

// ── Posts ─────────────────────────────────────────────────────────────────────

const rowToPost = (row: Record<string, unknown>): PalOptPost => ({
  id: String(row.id || ''),
  paletteId: String(row.palette_id || ''),
  title: String(row.title || ''),
  topic: String(row.topic || ''),
  keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
  targetAudience: (row.target_audience as string) || null,
  imageUrls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [],
  status: (row.status as PalOptPost['status']) || 'draft',
  instagramCaption: (row.instagram_caption as string) || null,
  instagramImageUrl: (row.instagram_image_url as string) || null,
  instagramPostId: (row.instagram_post_id as string) || null,
  blogTitle: (row.blog_title as string) || null,
  blogBodyHtml: (row.blog_body_html as string) || null,
  blogSlug: (row.blog_slug as string) || null,
  blogPostId: (row.blog_post_id as string) || null,
  gbpSummary: (row.gbp_summary as string) || null,
  gbpCallToAction: (row.gbp_call_to_action as string) || null,
  gbpPostId: (row.gbp_post_id as string) || null,
  publishedPlatforms: Array.isArray(row.published_platforms) ? (row.published_platforms as string[]) : [],
  errorLog: (row.error_log as string) || null,
  approvedAt: row.approved_at ? String(row.approved_at) : null,
  publishedAt: row.published_at ? String(row.published_at) : null,
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

export const getPostsByPaletteId = async (paletteId: string, limit = 20): Promise<PalOptPost[]> => {
  await ensurePalOptTables();
  const pid = String(paletteId || '').trim().toUpperCase();
  const { rows } = await sql`
    SELECT * FROM pal_opt_posts
    WHERE palette_id = ${pid}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToPost);
};

export const getPostById = async (id: string): Promise<PalOptPost | null> => {
  await ensurePalOptTables();
  const { rows } = await sql`SELECT * FROM pal_opt_posts WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rowToPost(rows[0]) : null;
};

export const createPost = async (paletteId: string, data: {
  title: string;
  topic: string;
  keywords: string[];
  targetAudience?: string | null;
  imageUrls?: string[];
}): Promise<PalOptPost> => {
  await ensurePalOptTables();
  const pid = String(paletteId || '').trim().toUpperCase();
  const id = randomUUID();
  const keywordsJson = JSON.stringify(data.keywords || []);
  const imageUrlsJson = JSON.stringify(data.imageUrls || []);

  await sql`
    INSERT INTO pal_opt_posts (id, palette_id, title, topic, keywords, target_audience, image_urls, status)
    VALUES (${id}, ${pid}, ${data.title}, ${data.topic}, ${keywordsJson}::jsonb, ${data.targetAudience ?? null}, ${imageUrlsJson}::jsonb, 'draft')
  `;

  const result = await getPostById(id);
  return result!;
};

export const updatePost = async (id: string, data: Partial<Omit<PalOptPost, 'id' | 'paletteId' | 'createdAt' | 'updatedAt'>>): Promise<PalOptPost | null> => {
  await ensurePalOptTables();

  const existing = await getPostById(id);
  if (!existing) return null;

  const status = data.status ?? existing.status;
  const title = data.title ?? existing.title;
  const topic = data.topic ?? existing.topic;
  const keywords = JSON.stringify(data.keywords ?? existing.keywords);
  const targetAudience = data.targetAudience !== undefined ? data.targetAudience : existing.targetAudience;
  const imageUrls = JSON.stringify(data.imageUrls ?? existing.imageUrls);
  const instagramCaption = data.instagramCaption !== undefined ? data.instagramCaption : existing.instagramCaption;
  const instagramImageUrl = data.instagramImageUrl !== undefined ? data.instagramImageUrl : existing.instagramImageUrl;
  const instagramPostId = data.instagramPostId !== undefined ? data.instagramPostId : existing.instagramPostId;
  const blogTitle = data.blogTitle !== undefined ? data.blogTitle : existing.blogTitle;
  const blogBodyHtml = data.blogBodyHtml !== undefined ? data.blogBodyHtml : existing.blogBodyHtml;
  const blogSlug = data.blogSlug !== undefined ? data.blogSlug : existing.blogSlug;
  const blogPostId = data.blogPostId !== undefined ? data.blogPostId : existing.blogPostId;
  const gbpSummary = data.gbpSummary !== undefined ? data.gbpSummary : existing.gbpSummary;
  const gbpCallToAction = data.gbpCallToAction !== undefined ? data.gbpCallToAction : existing.gbpCallToAction;
  const gbpPostId = data.gbpPostId !== undefined ? data.gbpPostId : existing.gbpPostId;
  const publishedPlatforms = JSON.stringify(data.publishedPlatforms ?? existing.publishedPlatforms);
  const errorLog = data.errorLog !== undefined ? data.errorLog : existing.errorLog;
  const approvedAt = data.approvedAt !== undefined ? data.approvedAt : existing.approvedAt;
  const publishedAt = data.publishedAt !== undefined ? data.publishedAt : existing.publishedAt;

  await sql`
    UPDATE pal_opt_posts SET
      status              = ${status},
      title               = ${title},
      topic               = ${topic},
      keywords            = ${keywords}::jsonb,
      target_audience     = ${targetAudience},
      image_urls          = ${imageUrls}::jsonb,
      instagram_caption   = ${instagramCaption},
      instagram_image_url = ${instagramImageUrl},
      instagram_post_id   = ${instagramPostId},
      blog_title          = ${blogTitle},
      blog_body_html      = ${blogBodyHtml},
      blog_slug           = ${blogSlug},
      blog_post_id        = ${blogPostId},
      gbp_summary         = ${gbpSummary},
      gbp_call_to_action  = ${gbpCallToAction},
      gbp_post_id         = ${gbpPostId},
      published_platforms = ${publishedPlatforms}::jsonb,
      error_log           = ${errorLog},
      approved_at         = ${approvedAt}::timestamptz,
      published_at        = ${publishedAt}::timestamptz,
      updated_at          = NOW()
    WHERE id = ${id}
  `;

  return getPostById(id);
};
