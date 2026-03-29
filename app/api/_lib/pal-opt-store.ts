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
  // X (Twitter) OAuth
  xAccessToken: string | null;
  xRefreshToken: string | null;
  // 通知設定
  notificationType: string | null;
  notificationEmail: string | null;
  lineUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostStatus = 'draft' | 'preview' | 'pending_approval' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';

export type PalOptPost = {
  id: string;
  paletteId: string;
  title: string;
  topic: string;
  keywords: string[];
  targetAudience: string | null;
  imageUrls: string[];
  status: PostStatus;
  instagramCaption: string | null;
  instagramImageUrl: string | null;
  instagramPostId: string | null;
  blogTitle: string | null;
  blogBodyHtml: string | null;
  blogSlug: string | null;
  blogImageUrl: string | null;
  blogPostId: string | null;
  gbpSummary: string | null;
  gbpCallToAction: string | null;
  gbpImageUrl: string | null;
  gbpPostId: string | null;
  // X (Twitter)
  xText: string | null;
  xImageUrl: string | null;
  xPostId: string | null;
  publishedPlatforms: string[];
  errorLog: string | null;
  // スケジュール
  scheduledAt: string | null;
  // テンプレート・計画
  templateId: string | null;
  planId: string | null;
  // ABテスト
  variationGroup: string | null;
  // 承認
  approvalNote: string | null;
  // クロスサービス連携
  source: string;
  sourceType: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PalOptTemplate = {
  id: string;
  paletteId: string | null;
  name: string;
  category: string | null;
  topic: string | null;
  tone: string | null;
  contentTemplate: Record<string, unknown>;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PalOptPlan = {
  id: string;
  paletteId: string;
  month: string;
  frequency: string;
  themes: string[];
  platforms: string[];
  postCount: number;
  createdAt: string;
};

// ── Ensure Tables ─────────────────────────────────────────────────────────────

export const ensurePalOptTables = async () => {
  // ── settings ──
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
  // settings 拡張カラム
  await sql`ALTER TABLE pal_opt_settings ADD COLUMN IF NOT EXISTS x_access_token TEXT`;
  await sql`ALTER TABLE pal_opt_settings ADD COLUMN IF NOT EXISTS x_refresh_token TEXT`;
  await sql`ALTER TABLE pal_opt_settings ADD COLUMN IF NOT EXISTS notification_type TEXT`;
  await sql`ALTER TABLE pal_opt_settings ADD COLUMN IF NOT EXISTS notification_email TEXT`;
  await sql`ALTER TABLE pal_opt_settings ADD COLUMN IF NOT EXISTS line_user_id TEXT`;

  // ── posts ──
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
  // posts 拡張カラム
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS x_text TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS x_image_url TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS x_post_id TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS blog_image_url TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS gbp_image_url TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS template_id TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS plan_id TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS variation_group TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS approval_note TEXT`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pal_opt'`;
  await sql`ALTER TABLE pal_opt_posts ADD COLUMN IF NOT EXISTS source_type TEXT`;

  await sql`CREATE INDEX IF NOT EXISTS pal_opt_posts_palette_id_idx ON pal_opt_posts (palette_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pal_opt_posts_status_idx ON pal_opt_posts (status)`;
  await sql`CREATE INDEX IF NOT EXISTS pal_opt_posts_scheduled_idx ON pal_opt_posts (status, scheduled_at)`;
  await sql`CREATE INDEX IF NOT EXISTS pal_opt_posts_updated_at_idx ON pal_opt_posts (updated_at DESC)`;

  // ── templates ──
  await sql`
    CREATE TABLE IF NOT EXISTS pal_opt_templates (
      id                TEXT PRIMARY KEY,
      palette_id        TEXT,
      name              TEXT NOT NULL,
      category          TEXT,
      topic             TEXT,
      tone              TEXT,
      content_template  JSONB NOT NULL DEFAULT '{}',
      is_system         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pal_opt_templates_palette_id_idx ON pal_opt_templates (palette_id)`;

  // ── plans ──
  await sql`
    CREATE TABLE IF NOT EXISTS pal_opt_plans (
      id          TEXT PRIMARY KEY,
      palette_id  TEXT NOT NULL,
      month       TEXT NOT NULL,
      frequency   TEXT NOT NULL DEFAULT '3x/week',
      themes      JSONB NOT NULL DEFAULT '[]',
      platforms   JSONB NOT NULL DEFAULT '[]',
      post_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pal_opt_plans_palette_id_idx ON pal_opt_plans (palette_id)`;
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
  xAccessToken: (row.x_access_token as string) || null,
  xRefreshToken: (row.x_refresh_token as string) || null,
  notificationType: (row.notification_type as string) || null,
  notificationEmail: (row.notification_email as string) || null,
  lineUserId: (row.line_user_id as string) || null,
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
  const xAccessToken = data.xAccessToken !== undefined ? data.xAccessToken : (existing?.xAccessToken ?? null);
  const xRefreshToken = data.xRefreshToken !== undefined ? data.xRefreshToken : (existing?.xRefreshToken ?? null);
  const notificationType = data.notificationType !== undefined ? data.notificationType : (existing?.notificationType ?? null);
  const notificationEmail = data.notificationEmail !== undefined ? data.notificationEmail : (existing?.notificationEmail ?? null);
  const lineUserId = data.lineUserId !== undefined ? data.lineUserId : (existing?.lineUserId ?? null);

  const keywordsJson = JSON.stringify(targetKeywords);

  await sql`
    INSERT INTO pal_opt_settings (
      id, palette_id, ig_access_token, ig_business_account_id,
      gbp_access_token, gbp_refresh_token, gbp_location_id,
      blog_url, blog_wp_username, blog_api_key,
      target_keywords, goals, default_tone, has_pal_studio, has_pal_trust,
      x_access_token, x_refresh_token,
      notification_type, notification_email, line_user_id
    ) VALUES (
      ${id}, ${pid}, ${igAccessToken}, ${igBusinessAccountId},
      ${gbpAccessToken}, ${gbpRefreshToken}, ${gbpLocationId},
      ${blogUrl}, ${blogWpUsername}, ${blogApiKey},
      ${keywordsJson}::jsonb, ${goals}, ${defaultTone}, ${hasPalStudio}, ${hasPalTrust},
      ${xAccessToken}, ${xRefreshToken},
      ${notificationType}, ${notificationEmail}, ${lineUserId}
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
      x_access_token          = EXCLUDED.x_access_token,
      x_refresh_token         = EXCLUDED.x_refresh_token,
      notification_type       = EXCLUDED.notification_type,
      notification_email      = EXCLUDED.notification_email,
      line_user_id            = EXCLUDED.line_user_id,
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
  status: (row.status as PostStatus) || 'draft',
  instagramCaption: (row.instagram_caption as string) || null,
  instagramImageUrl: (row.instagram_image_url as string) || null,
  instagramPostId: (row.instagram_post_id as string) || null,
  blogTitle: (row.blog_title as string) || null,
  blogBodyHtml: (row.blog_body_html as string) || null,
  blogSlug: (row.blog_slug as string) || null,
  blogImageUrl: (row.blog_image_url as string) || null,
  blogPostId: (row.blog_post_id as string) || null,
  gbpSummary: (row.gbp_summary as string) || null,
  gbpCallToAction: (row.gbp_call_to_action as string) || null,
  gbpImageUrl: (row.gbp_image_url as string) || null,
  gbpPostId: (row.gbp_post_id as string) || null,
  xText: (row.x_text as string) || null,
  xImageUrl: (row.x_image_url as string) || null,
  xPostId: (row.x_post_id as string) || null,
  publishedPlatforms: Array.isArray(row.published_platforms) ? (row.published_platforms as string[]) : [],
  errorLog: (row.error_log as string) || null,
  scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
  templateId: (row.template_id as string) || null,
  planId: (row.plan_id as string) || null,
  variationGroup: (row.variation_group as string) || null,
  approvalNote: (row.approval_note as string) || null,
  source: String(row.source || 'pal_opt'),
  sourceType: (row.source_type as string) || null,
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

export type CreatePostInput = {
  title: string;
  topic: string;
  keywords: string[];
  targetAudience?: string | null;
  imageUrls?: string[];
  status?: PostStatus;
  instagramCaption?: string | null;
  instagramImageUrl?: string | null;
  blogTitle?: string | null;
  blogBodyHtml?: string | null;
  blogSlug?: string | null;
  blogImageUrl?: string | null;
  gbpSummary?: string | null;
  gbpCallToAction?: string | null;
  gbpImageUrl?: string | null;
  xText?: string | null;
  xImageUrl?: string | null;
  scheduledAt?: string | null;
  templateId?: string | null;
  planId?: string | null;
  variationGroup?: string | null;
  source?: string;
  sourceType?: string | null;
};

export const createPost = async (paletteId: string, data: CreatePostInput): Promise<PalOptPost> => {
  await ensurePalOptTables();
  const pid = String(paletteId || '').trim().toUpperCase();
  const id = randomUUID();
  const keywordsJson = JSON.stringify(data.keywords || []);
  const imageUrlsJson = JSON.stringify(data.imageUrls || []);
  const status = data.status || 'draft';
  const source = data.source || 'pal_opt';

  await sql`
    INSERT INTO pal_opt_posts (
      id, palette_id, title, topic, keywords, target_audience, image_urls, status,
      instagram_caption, instagram_image_url, blog_title, blog_body_html, blog_slug, blog_image_url,
      gbp_summary, gbp_call_to_action, gbp_image_url, x_text, x_image_url,
      scheduled_at, template_id, plan_id, variation_group, source, source_type
    ) VALUES (
      ${id}, ${pid}, ${data.title}, ${data.topic}, ${keywordsJson}::jsonb,
      ${data.targetAudience ?? null}, ${imageUrlsJson}::jsonb, ${status},
      ${data.instagramCaption ?? null}, ${data.instagramImageUrl ?? null},
      ${data.blogTitle ?? null}, ${data.blogBodyHtml ?? null}, ${data.blogSlug ?? null}, ${data.blogImageUrl ?? null},
      ${data.gbpSummary ?? null}, ${data.gbpCallToAction ?? null}, ${data.gbpImageUrl ?? null},
      ${data.xText ?? null}, ${data.xImageUrl ?? null},
      ${data.scheduledAt ?? null}::timestamptz, ${data.templateId ?? null},
      ${data.planId ?? null}, ${data.variationGroup ?? null},
      ${source}, ${data.sourceType ?? null}
    )
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
  const blogImageUrl = data.blogImageUrl !== undefined ? data.blogImageUrl : existing.blogImageUrl;
  const blogPostId = data.blogPostId !== undefined ? data.blogPostId : existing.blogPostId;
  const gbpSummary = data.gbpSummary !== undefined ? data.gbpSummary : existing.gbpSummary;
  const gbpCallToAction = data.gbpCallToAction !== undefined ? data.gbpCallToAction : existing.gbpCallToAction;
  const gbpImageUrl = data.gbpImageUrl !== undefined ? data.gbpImageUrl : existing.gbpImageUrl;
  const gbpPostId = data.gbpPostId !== undefined ? data.gbpPostId : existing.gbpPostId;
  const xText = data.xText !== undefined ? data.xText : existing.xText;
  const xImageUrl = data.xImageUrl !== undefined ? data.xImageUrl : existing.xImageUrl;
  const xPostId = data.xPostId !== undefined ? data.xPostId : existing.xPostId;
  const publishedPlatforms = JSON.stringify(data.publishedPlatforms ?? existing.publishedPlatforms);
  const errorLog = data.errorLog !== undefined ? data.errorLog : existing.errorLog;
  const scheduledAt = data.scheduledAt !== undefined ? data.scheduledAt : existing.scheduledAt;
  const templateId = data.templateId !== undefined ? data.templateId : existing.templateId;
  const planId = data.planId !== undefined ? data.planId : existing.planId;
  const variationGroup = data.variationGroup !== undefined ? data.variationGroup : existing.variationGroup;
  const approvalNote = data.approvalNote !== undefined ? data.approvalNote : existing.approvalNote;
  const source = data.source !== undefined ? data.source : existing.source;
  const sourceType = data.sourceType !== undefined ? data.sourceType : existing.sourceType;
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
      blog_image_url      = ${blogImageUrl},
      blog_post_id        = ${blogPostId},
      gbp_summary         = ${gbpSummary},
      gbp_call_to_action  = ${gbpCallToAction},
      gbp_image_url       = ${gbpImageUrl},
      gbp_post_id         = ${gbpPostId},
      x_text              = ${xText},
      x_image_url         = ${xImageUrl},
      x_post_id           = ${xPostId},
      published_platforms = ${publishedPlatforms}::jsonb,
      error_log           = ${errorLog},
      scheduled_at        = ${scheduledAt}::timestamptz,
      template_id         = ${templateId},
      plan_id             = ${planId},
      variation_group     = ${variationGroup},
      approval_note       = ${approvalNote},
      source              = ${source},
      source_type         = ${sourceType},
      approved_at         = ${approvedAt}::timestamptz,
      published_at        = ${publishedAt}::timestamptz,
      updated_at          = NOW()
    WHERE id = ${id}
  `;

  return getPostById(id);
};

// ── Templates ─────────────────────────────────────────────────────────────────

const rowToTemplate = (row: Record<string, unknown>): PalOptTemplate => ({
  id: String(row.id || ''),
  paletteId: (row.palette_id as string) || null,
  name: String(row.name || ''),
  category: (row.category as string) || null,
  topic: (row.topic as string) || null,
  tone: (row.tone as string) || null,
  contentTemplate: (row.content_template as Record<string, unknown>) || {},
  isSystem: Boolean(row.is_system),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

export const listTemplates = async (paletteId?: string): Promise<PalOptTemplate[]> => {
  await ensurePalOptTables();
  if (paletteId) {
    const pid = String(paletteId).trim().toUpperCase();
    const { rows } = await sql`
      SELECT * FROM pal_opt_templates
      WHERE palette_id = ${pid} OR is_system = TRUE
      ORDER BY is_system DESC, updated_at DESC
    `;
    return rows.map(rowToTemplate);
  }
  const { rows } = await sql`SELECT * FROM pal_opt_templates ORDER BY is_system DESC, updated_at DESC`;
  return rows.map(rowToTemplate);
};

export const getTemplateById = async (id: string): Promise<PalOptTemplate | null> => {
  await ensurePalOptTables();
  const { rows } = await sql`SELECT * FROM pal_opt_templates WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
};

export const upsertTemplate = async (data: {
  id?: string;
  paletteId?: string | null;
  name: string;
  category?: string | null;
  topic?: string | null;
  tone?: string | null;
  contentTemplate?: Record<string, unknown>;
  isSystem?: boolean;
}): Promise<PalOptTemplate> => {
  await ensurePalOptTables();
  const id = data.id || randomUUID();
  const paletteId = data.paletteId ? String(data.paletteId).trim().toUpperCase() : null;
  const contentJson = JSON.stringify(data.contentTemplate || {});

  await sql`
    INSERT INTO pal_opt_templates (id, palette_id, name, category, topic, tone, content_template, is_system)
    VALUES (${id}, ${paletteId}, ${data.name}, ${data.category ?? null}, ${data.topic ?? null}, ${data.tone ?? null}, ${contentJson}::jsonb, ${data.isSystem ?? false})
    ON CONFLICT (id) DO UPDATE SET
      name              = EXCLUDED.name,
      category          = EXCLUDED.category,
      topic             = EXCLUDED.topic,
      tone              = EXCLUDED.tone,
      content_template  = EXCLUDED.content_template,
      updated_at        = NOW()
  `;

  const result = await getTemplateById(id);
  return result!;
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await ensurePalOptTables();
  await sql`DELETE FROM pal_opt_templates WHERE id = ${id} AND is_system = FALSE`;
};

// ── Plans ─────────────────────────────────────────────────────────────────────

const rowToPlan = (row: Record<string, unknown>): PalOptPlan => ({
  id: String(row.id || ''),
  paletteId: String(row.palette_id || ''),
  month: String(row.month || ''),
  frequency: String(row.frequency || '3x/week'),
  themes: Array.isArray(row.themes) ? (row.themes as string[]) : [],
  platforms: Array.isArray(row.platforms) ? (row.platforms as string[]) : [],
  postCount: Number(row.post_count || 0),
  createdAt: String(row.created_at || ''),
});

export const createPlan = async (data: {
  paletteId: string;
  month: string;
  frequency: string;
  themes: string[];
  platforms: string[];
  postCount: number;
}): Promise<PalOptPlan> => {
  await ensurePalOptTables();
  const id = randomUUID();
  const pid = String(data.paletteId).trim().toUpperCase();
  const themesJson = JSON.stringify(data.themes || []);
  const platformsJson = JSON.stringify(data.platforms || []);

  await sql`
    INSERT INTO pal_opt_plans (id, palette_id, month, frequency, themes, platforms, post_count)
    VALUES (${id}, ${pid}, ${data.month}, ${data.frequency}, ${themesJson}::jsonb, ${platformsJson}::jsonb, ${data.postCount})
  `;

  const { rows } = await sql`SELECT * FROM pal_opt_plans WHERE id = ${id} LIMIT 1`;
  return rowToPlan(rows[0]);
};

export const listPlansByPaletteId = async (paletteId: string): Promise<PalOptPlan[]> => {
  await ensurePalOptTables();
  const pid = String(paletteId).trim().toUpperCase();
  const { rows } = await sql`
    SELECT * FROM pal_opt_plans WHERE palette_id = ${pid} ORDER BY month DESC, created_at DESC
  `;
  return rows.map(rowToPlan);
};

// ── Scheduled Posts Query (for scheduler) ─────────────────────────────────────

export const getScheduledPostsDue = async (): Promise<PalOptPost[]> => {
  await ensurePalOptTables();
  const { rows } = await sql`
    SELECT * FROM pal_opt_posts
    WHERE status = 'scheduled' AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT 50
  `;
  return rows.map(rowToPost);
};

export const getPostsByPlanId = async (planId: string): Promise<PalOptPost[]> => {
  await ensurePalOptTables();
  const { rows } = await sql`
    SELECT * FROM pal_opt_posts WHERE plan_id = ${planId} ORDER BY scheduled_at ASC, created_at ASC
  `;
  return rows.map(rowToPost);
};
