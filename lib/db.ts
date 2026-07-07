/**
 * Pal Opt (AIO) のDBストア層。
 * 旧SNS投稿時代のテーブルは legacy_pal_opt_* に退避済み。以下は新スキーマ。
 */
import { sql } from '@vercel/postgres';

let ensured: Promise<void> | null = null;

export const ensureTables = (): Promise<void> => {
  if (!ensured) {
    ensured = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS pal_opt_projects (
          id SERIAL PRIMARY KEY,
          palette_id TEXT UNIQUE NOT NULL,
          business_name TEXT NOT NULL,
          business_aliases JSONB NOT NULL DEFAULT '[]',
          site_url TEXT,
          industry TEXT,
          area TEXT,
          competitors JSONB NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS pal_opt_prompts (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES pal_opt_projects(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          active BOOLEAN NOT NULL DEFAULT true,
          last_run_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS pal_opt_runs (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES pal_opt_projects(id) ON DELETE CASCADE,
          prompt_id INTEGER NOT NULL REFERENCES pal_opt_prompts(id) ON DELETE CASCADE,
          engine TEXT NOT NULL,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          answer_text TEXT NOT NULL DEFAULT '',
          mentioned BOOLEAN NOT NULL DEFAULT false,
          mention_position INTEGER,
          sentiment TEXT,
          competitors_mentioned JSONB NOT NULL DEFAULT '[]',
          cited BOOLEAN NOT NULL DEFAULT false,
          citations JSONB NOT NULL DEFAULT '[]',
          error TEXT
        )`;
      await sql`CREATE INDEX IF NOT EXISTS pal_opt_runs_project_idx ON pal_opt_runs (project_id, executed_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS pal_opt_runs_prompt_idx ON pal_opt_runs (prompt_id, executed_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS pal_opt_prompts_project_idx ON pal_opt_prompts (project_id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS pal_opt_audits (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES pal_opt_projects(id) ON DELETE CASCADE,
          run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          score INTEGER NOT NULL DEFAULT 0,
          checks JSONB NOT NULL DEFAULT '[]',
          fetched_url TEXT
        )`;
      await sql`CREATE INDEX IF NOT EXISTS pal_opt_audits_project_idx ON pal_opt_audits (project_id, run_at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS pal_opt_actions (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES pal_opt_projects(id) ON DELETE CASCADE,
          category TEXT NOT NULL DEFAULT 'other',
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          deliverable TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          done_at TIMESTAMPTZ
        )`;
      await sql`CREATE INDEX IF NOT EXISTS pal_opt_actions_project_idx ON pal_opt_actions (project_id, status)`;
      await sql`ALTER TABLE pal_opt_projects ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`;
      await sql`ALTER TABLE pal_opt_projects ADD COLUMN IF NOT EXISTS gbp_location TEXT`;
      await sql`ALTER TABLE pal_opt_projects ADD COLUMN IF NOT EXISTS gsc_site TEXT`;
    })();
  }
  return ensured;
};

export type Project = {
  id: number;
  paletteId: string;
  businessName: string;
  businessAliases: string[];
  siteUrl: string | null;
  industry: string | null;
  area: string | null;
  competitors: string[];
  status: string;
  googleConnected: boolean;
  gbpLocation: string | null;
  gscSite: string | null;
};

export type Prompt = {
  id: number;
  projectId: number;
  text: string;
  category: string;
  active: boolean;
  lastRunAt: string | null;
};

export type Citation = { title: string; uri: string };

export type Run = {
  id: number;
  projectId: number;
  promptId: number;
  engine: string;
  executedAt: string;
  answerText: string;
  mentioned: boolean;
  mentionPosition: number | null;
  sentiment: string | null;
  competitorsMentioned: string[];
  cited: boolean;
  citations: Citation[];
  error: string | null;
};

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

const rowToProject = (r: Record<string, unknown>): Project => ({
  id: Number(r.id),
  paletteId: String(r.palette_id),
  businessName: String(r.business_name),
  businessAliases: toStringArray(r.business_aliases),
  siteUrl: r.site_url ? String(r.site_url) : null,
  industry: r.industry ? String(r.industry) : null,
  area: r.area ? String(r.area) : null,
  competitors: toStringArray(r.competitors),
  status: String(r.status),
  googleConnected: Boolean(r.google_refresh_token),
  gbpLocation: r.gbp_location ? String(r.gbp_location) : null,
  gscSite: r.gsc_site ? String(r.gsc_site) : null,
});

/** Google連携情報の保存（refresh tokenは上書きのみ・nullで解除） */
export const setProjectGoogleToken = async (projectId: number, refreshToken: string | null): Promise<void> => {
  await ensureTables();
  await sql`UPDATE pal_opt_projects SET google_refresh_token = ${refreshToken}, updated_at = NOW() WHERE id = ${projectId}`;
};

export const setProjectGoogleSelection = async (
  projectId: number,
  sel: { gbpLocation?: string | null; gscSite?: string | null },
): Promise<void> => {
  await ensureTables();
  if (sel.gbpLocation !== undefined) {
    await sql`UPDATE pal_opt_projects SET gbp_location = ${sel.gbpLocation}, updated_at = NOW() WHERE id = ${projectId}`;
  }
  if (sel.gscSite !== undefined) {
    await sql`UPDATE pal_opt_projects SET gsc_site = ${sel.gscSite}, updated_at = NOW() WHERE id = ${projectId}`;
  }
};

/** サーバー内部専用: refresh token取得（APIレスポンスに載せないこと） */
export const getProjectGoogleToken = async (projectId: number): Promise<string | null> => {
  await ensureTables();
  const { rows } = await sql`SELECT google_refresh_token FROM pal_opt_projects WHERE id = ${projectId}`;
  return rows[0]?.google_refresh_token ? String(rows[0].google_refresh_token) : null;
};

const rowToPrompt = (r: Record<string, unknown>): Prompt => ({
  id: Number(r.id),
  projectId: Number(r.project_id),
  text: String(r.text),
  category: String(r.category),
  active: Boolean(r.active),
  lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
});

const rowToRun = (r: Record<string, unknown>): Run => ({
  id: Number(r.id),
  projectId: Number(r.project_id),
  promptId: Number(r.prompt_id),
  engine: String(r.engine),
  executedAt: String(r.executed_at),
  answerText: String(r.answer_text ?? ''),
  mentioned: Boolean(r.mentioned),
  mentionPosition: r.mention_position === null || r.mention_position === undefined ? null : Number(r.mention_position),
  sentiment: r.sentiment ? String(r.sentiment) : null,
  competitorsMentioned: toStringArray(r.competitors_mentioned),
  cited: Boolean(r.cited),
  citations: Array.isArray(r.citations) ? (r.citations as Citation[]) : [],
  error: r.error ? String(r.error) : null,
});

// ---------- Projects ----------

export const getProjectByPaletteId = async (paletteId: string): Promise<Project | null> => {
  await ensureTables();
  const { rows } = await sql`SELECT * FROM pal_opt_projects WHERE palette_id = ${paletteId} LIMIT 1`;
  return rows.length ? rowToProject(rows[0]) : null;
};

export const upsertProject = async (input: {
  paletteId: string;
  businessName: string;
  businessAliases?: string[];
  siteUrl?: string | null;
  industry?: string | null;
  area?: string | null;
  competitors?: string[];
}): Promise<Project> => {
  await ensureTables();
  const { rows } = await sql`
    INSERT INTO pal_opt_projects (palette_id, business_name, business_aliases, site_url, industry, area, competitors)
    VALUES (${input.paletteId}, ${input.businessName}, ${JSON.stringify(input.businessAliases ?? [])},
            ${input.siteUrl ?? null}, ${input.industry ?? null}, ${input.area ?? null},
            ${JSON.stringify(input.competitors ?? [])})
    ON CONFLICT (palette_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      business_aliases = EXCLUDED.business_aliases,
      site_url = EXCLUDED.site_url,
      industry = EXCLUDED.industry,
      area = EXCLUDED.area,
      competitors = EXCLUDED.competitors,
      updated_at = NOW()
    RETURNING *`;
  return rowToProject(rows[0]);
};

// ---------- Prompts ----------

export const listPrompts = async (projectId: number): Promise<Prompt[]> => {
  await ensureTables();
  const { rows } = await sql`SELECT * FROM pal_opt_prompts WHERE project_id = ${projectId} ORDER BY category, id`;
  return rows.map(rowToPrompt);
};

export const insertPrompts = async (
  projectId: number,
  prompts: Array<{ text: string; category: string }>,
): Promise<number> => {
  await ensureTables();
  let inserted = 0;
  for (const p of prompts) {
    const text = p.text.trim();
    if (!text) continue;
    const { rowCount } = await sql`
      INSERT INTO pal_opt_prompts (project_id, text, category)
      SELECT ${projectId}, ${text}, ${p.category || 'general'}
      WHERE NOT EXISTS (
        SELECT 1 FROM pal_opt_prompts WHERE project_id = ${projectId} AND text = ${text}
      )`;
    inserted += rowCount ?? 0;
  }
  return inserted;
};

export const setPromptActive = async (projectId: number, promptId: number, active: boolean): Promise<void> => {
  await ensureTables();
  await sql`UPDATE pal_opt_prompts SET active = ${active} WHERE id = ${promptId} AND project_id = ${projectId}`;
};

/** 収集対象: activeかつ本日まだ実行していないプロンプト（古い順） */
export const listDuePrompts = async (limit: number): Promise<Array<Prompt & { project: Project }>> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT p.*, pr.id AS pr_id, pr.palette_id, pr.business_name, pr.business_aliases,
           pr.site_url, pr.industry, pr.area, pr.competitors, pr.status
    FROM pal_opt_prompts p
    JOIN pal_opt_projects pr ON pr.id = p.project_id
    WHERE p.active = true
      AND pr.status = 'active'
      AND (p.last_run_at IS NULL OR p.last_run_at < date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo')
    ORDER BY p.last_run_at ASC NULLS FIRST, p.id
    LIMIT ${limit}`;
  return rows.map((r) => ({
    ...rowToPrompt(r),
    project: rowToProject({ ...r, id: r.pr_id }),
  }));
};

export const countDuePrompts = async (): Promise<number> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT count(*)::int AS n
    FROM pal_opt_prompts p
    JOIN pal_opt_projects pr ON pr.id = p.project_id
    WHERE p.active = true
      AND pr.status = 'active'
      AND (p.last_run_at IS NULL OR p.last_run_at < date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo')`;
  return Number(rows[0]?.n ?? 0);
};

export const markPromptRun = async (promptId: number): Promise<void> => {
  await sql`UPDATE pal_opt_prompts SET last_run_at = NOW() WHERE id = ${promptId}`;
};

// ---------- Runs ----------

export const insertRun = async (run: {
  projectId: number;
  promptId: number;
  engine: string;
  answerText: string;
  mentioned: boolean;
  mentionPosition: number | null;
  sentiment: string | null;
  competitorsMentioned: string[];
  cited: boolean;
  citations: Citation[];
  error?: string | null;
}): Promise<void> => {
  await ensureTables();
  await sql`
    INSERT INTO pal_opt_runs
      (project_id, prompt_id, engine, answer_text, mentioned, mention_position, sentiment,
       competitors_mentioned, cited, citations, error)
    VALUES
      (${run.projectId}, ${run.promptId}, ${run.engine}, ${run.answerText}, ${run.mentioned},
       ${run.mentionPosition}, ${run.sentiment}, ${JSON.stringify(run.competitorsMentioned)},
       ${run.cited}, ${JSON.stringify(run.citations)}, ${run.error ?? null})`;
};

export const listRuns = async (
  projectId: number,
  opts?: { limit?: number; engine?: string; mentionedOnly?: boolean },
): Promise<Array<Run & { promptText: string }>> => {
  await ensureTables();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const engine = opts?.engine ?? null;
  const mentionedOnly = opts?.mentionedOnly ?? false;
  const { rows } = await sql`
    SELECT r.*, p.text AS prompt_text
    FROM pal_opt_runs r
    JOIN pal_opt_prompts p ON p.id = r.prompt_id
    WHERE r.project_id = ${projectId}
      AND (${engine}::text IS NULL OR r.engine = ${engine})
      AND (${mentionedOnly} = false OR r.mentioned = true)
    ORDER BY r.executed_at DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ ...rowToRun(r), promptText: String(r.prompt_text) }));
};

// ---------- Audits ----------

export type Audit = {
  id: number;
  projectId: number;
  runAt: string;
  score: number;
  checks: unknown[];
  fetchedUrl: string | null;
};

const rowToAudit = (r: Record<string, unknown>): Audit => ({
  id: Number(r.id),
  projectId: Number(r.project_id),
  runAt: String(r.run_at),
  score: Number(r.score),
  checks: Array.isArray(r.checks) ? (r.checks as unknown[]) : [],
  fetchedUrl: r.fetched_url ? String(r.fetched_url) : null,
});

export const insertAudit = async (projectId: number, score: number, checks: unknown[], fetchedUrl: string | null): Promise<Audit> => {
  await ensureTables();
  const { rows } = await sql`
    INSERT INTO pal_opt_audits (project_id, score, checks, fetched_url)
    VALUES (${projectId}, ${score}, ${JSON.stringify(checks)}, ${fetchedUrl})
    RETURNING *`;
  return rowToAudit(rows[0]);
};

export const getLatestAudit = async (projectId: number): Promise<Audit | null> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM pal_opt_audits WHERE project_id = ${projectId} ORDER BY run_at DESC LIMIT 1`;
  return rows.length ? rowToAudit(rows[0]) : null;
};

export const getAuditHistory = async (projectId: number, limit = 12): Promise<Array<{ runAt: string; score: number }>> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT run_at, score FROM pal_opt_audits WHERE project_id = ${projectId} ORDER BY run_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ runAt: String(r.run_at), score: Number(r.score) })).reverse();
};

/** 週次自動診断の対象（直近7日診断がない active プロジェクト） */
export const listProjectsNeedingAudit = async (limit = 10): Promise<Project[]> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT pr.* FROM pal_opt_projects pr
    WHERE pr.status = 'active' AND pr.site_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pal_opt_audits a
        WHERE a.project_id = pr.id AND a.run_at > NOW() - interval '7 days'
      )
    ORDER BY pr.id LIMIT ${limit}`;
  return rows.map(rowToProject);
};

// ---------- Actions（改善タスク） ----------

export type Action = {
  id: number;
  projectId: number;
  category: string;
  title: string;
  description: string;
  deliverable: string | null;
  status: 'open' | 'done' | 'dismissed';
  createdAt: string;
  doneAt: string | null;
};

const rowToAction = (r: Record<string, unknown>): Action => ({
  id: Number(r.id),
  projectId: Number(r.project_id),
  category: String(r.category),
  title: String(r.title),
  description: String(r.description ?? ''),
  deliverable: r.deliverable ? String(r.deliverable) : null,
  status: (['open', 'done', 'dismissed'].includes(String(r.status)) ? String(r.status) : 'open') as Action['status'],
  createdAt: String(r.created_at),
  doneAt: r.done_at ? String(r.done_at) : null,
});

export const listActions = async (projectId: number): Promise<Action[]> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM pal_opt_actions WHERE project_id = ${projectId}
    ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'done' THEN 1 ELSE 2 END, created_at DESC`;
  return rows.map(rowToAction);
};

export const insertActions = async (
  projectId: number,
  actions: Array<{ category: string; title: string; description: string; deliverable?: string | null }>,
): Promise<number> => {
  await ensureTables();
  let inserted = 0;
  for (const a of actions) {
    const title = a.title.trim();
    if (!title) continue;
    const { rowCount } = await sql`
      INSERT INTO pal_opt_actions (project_id, category, title, description, deliverable)
      SELECT ${projectId}, ${a.category || 'other'}, ${title}, ${a.description || ''}, ${a.deliverable ?? null}
      WHERE NOT EXISTS (
        SELECT 1 FROM pal_opt_actions
        WHERE project_id = ${projectId} AND title = ${title} AND status != 'dismissed'
      )`;
    inserted += rowCount ?? 0;
  }
  return inserted;
};

export const getAction = async (projectId: number, actionId: number): Promise<Action | null> => {
  await ensureTables();
  const { rows } = await sql`SELECT * FROM pal_opt_actions WHERE id = ${actionId} AND project_id = ${projectId} LIMIT 1`;
  return rows.length ? rowToAction(rows[0]) : null;
};

export const setActionStatus = async (projectId: number, actionId: number, status: Action['status']): Promise<void> => {
  await ensureTables();
  await sql`
    UPDATE pal_opt_actions
    SET status = ${status}, done_at = ${status === 'done' ? new Date().toISOString() : null}
    WHERE id = ${actionId} AND project_id = ${projectId}`;
};

/** 直近14日でAIに言及されなかった質問（改善タスク生成の材料） */
export const listMissedPrompts = async (projectId: number, limit = 8): Promise<Array<{ text: string; misses: number }>> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT p.text, count(*)::int AS misses
    FROM pal_opt_runs r
    JOIN pal_opt_prompts p ON p.id = r.prompt_id
    WHERE r.project_id = ${projectId}
      AND r.mentioned = false AND r.error IS NULL
      AND r.executed_at > NOW() - interval '14 days'
    GROUP BY p.text
    ORDER BY misses DESC, p.text
    LIMIT ${limit}`;
  return rows.map((r) => ({ text: String(r.text), misses: Number(r.misses) }));
};

// ---------- 競合SoV / 引用元 / 月次集計 ----------

export type SovEntry = { name: string; mentions: number; isSelf: boolean };

/** 自社と競合の言及回数（Share of Voice）。期間はJST日数。 */
export const getShareOfVoice = async (projectId: number, days = 30): Promise<SovEntry[]> => {
  await ensureTables();
  const { rows: [self] } = await sql`
    SELECT count(*) FILTER (WHERE mentioned)::int AS n
    FROM pal_opt_runs
    WHERE project_id = ${projectId} AND error IS NULL
      AND executed_at > NOW() - (${days} || ' days')::interval`;
  const { rows } = await sql`
    SELECT jsonb_array_elements_text(competitors_mentioned) AS name, count(*)::int AS n
    FROM pal_opt_runs
    WHERE project_id = ${projectId} AND error IS NULL
      AND executed_at > NOW() - (${days} || ' days')::interval
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
  const { rows: [proj] } = await sql`SELECT business_name FROM pal_opt_projects WHERE id = ${projectId}`;
  return [
    { name: String(proj?.business_name ?? '自社'), mentions: Number(self?.n ?? 0), isSelf: true },
    ...rows.map((r) => ({ name: String(r.name), mentions: Number(r.n), isSelf: false })),
  ].sort((a, b) => b.mentions - a.mentions);
};

/** AIが引用した情報源ドメインのトップ（サイテーション獲得の営業先リスト） */
export const getTopCitations = async (projectId: number, days = 30): Promise<Array<{ domain: string; count: number }>> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT lower(c->>'title') AS domain, count(*)::int AS n
    FROM pal_opt_runs r, jsonb_array_elements(r.citations) AS c
    WHERE r.project_id = ${projectId} AND r.error IS NULL
      AND r.executed_at > NOW() - (${days} || ' days')::interval
      AND coalesce(c->>'title','') <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`;
  return rows.map((r) => ({ domain: String(r.domain), count: Number(r.n) }));
};

export type MonthlySummary = {
  month: string; // YYYY-MM
  totalRuns: number;
  mentionedRuns: number;
  citedRuns: number;
  byEngine: Array<{ engine: string; total: number; mentioned: number }>;
  bestAnswers: Array<{ promptText: string; engine: string; answerText: string; mentionPosition: number | null }>;
  doneActions: Array<{ title: string; category: string; doneAt: string | null }>;
  prevMentionRate: number | null; // 前月の言及率(%)
};

/** 月次レポート用の集計（JST月境界） */
export const getMonthlySummary = async (projectId: number, month: string): Promise<MonthlySummary> => {
  await ensureTables();
  const start = `${month}-01`;

  const { rows: [totals] } = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE mentioned)::int AS mentioned,
           count(*) FILTER (WHERE cited)::int AS cited
    FROM pal_opt_runs
    WHERE project_id = ${projectId} AND error IS NULL
      AND executed_at >= (${start}::date AT TIME ZONE 'Asia/Tokyo')
      AND executed_at < ((${start}::date + interval '1 month') AT TIME ZONE 'Asia/Tokyo')`;
  const { rows: engines } = await sql`
    SELECT engine, count(*)::int AS total, count(*) FILTER (WHERE mentioned)::int AS mentioned
    FROM pal_opt_runs
    WHERE project_id = ${projectId} AND error IS NULL
      AND executed_at >= (${start}::date AT TIME ZONE 'Asia/Tokyo')
      AND executed_at < ((${start}::date + interval '1 month') AT TIME ZONE 'Asia/Tokyo')
    GROUP BY engine ORDER BY engine`;
  const { rows: best } = await sql`
    SELECT p.text AS prompt_text, r.engine, r.answer_text, r.mention_position
    FROM pal_opt_runs r JOIN pal_opt_prompts p ON p.id = r.prompt_id
    WHERE r.project_id = ${projectId} AND r.mentioned = true AND r.error IS NULL
      AND r.executed_at >= (${start}::date AT TIME ZONE 'Asia/Tokyo')
      AND r.executed_at < ((${start}::date + interval '1 month') AT TIME ZONE 'Asia/Tokyo')
    ORDER BY coalesce(r.mention_position, 99), r.executed_at DESC LIMIT 3`;
  const { rows: doneActs } = await sql`
    SELECT title, category, done_at FROM pal_opt_actions
    WHERE project_id = ${projectId} AND status = 'done'
      AND done_at >= (${start}::date AT TIME ZONE 'Asia/Tokyo')
      AND done_at < ((${start}::date + interval '1 month') AT TIME ZONE 'Asia/Tokyo')
    ORDER BY done_at`;
  const { rows: [prev] } = await sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE mentioned)::int AS mentioned
    FROM pal_opt_runs
    WHERE project_id = ${projectId} AND error IS NULL
      AND executed_at >= ((${start}::date - interval '1 month') AT TIME ZONE 'Asia/Tokyo')
      AND executed_at < (${start}::date AT TIME ZONE 'Asia/Tokyo')`;

  return {
    month,
    totalRuns: Number(totals?.total ?? 0),
    mentionedRuns: Number(totals?.mentioned ?? 0),
    citedRuns: Number(totals?.cited ?? 0),
    byEngine: engines.map((r) => ({ engine: String(r.engine), total: Number(r.total), mentioned: Number(r.mentioned) })),
    bestAnswers: best.map((r) => ({
      promptText: String(r.prompt_text),
      engine: String(r.engine),
      answerText: String(r.answer_text),
      mentionPosition: r.mention_position === null ? null : Number(r.mention_position),
    })),
    doneActions: doneActs.map((r) => ({ title: String(r.title), category: String(r.category), doneAt: r.done_at ? String(r.done_at) : null })),
    prevMentionRate: Number(prev?.total ?? 0) > 0 ? Math.round((Number(prev.mentioned) / Number(prev.total)) * 100) : null,
  };
};

// ---------- 管理者用 ----------

export type AdminProjectStat = {
  projectId: number;
  paletteId: string;
  businessName: string;
  activePrompts: number;
  runs7d: number;
  mentioned7d: number;
  errors7d: number;
  lastRunAt: string | null;
  auditScore: number | null;
};

export const listAllProjectStats = async (): Promise<AdminProjectStat[]> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT pr.id, pr.palette_id, pr.business_name,
      (SELECT count(*)::int FROM pal_opt_prompts p WHERE p.project_id = pr.id AND p.active) AS active_prompts,
      (SELECT count(*)::int FROM pal_opt_runs r WHERE r.project_id = pr.id AND r.executed_at > NOW() - interval '7 days') AS runs7d,
      (SELECT count(*)::int FROM pal_opt_runs r WHERE r.project_id = pr.id AND r.mentioned AND r.error IS NULL AND r.executed_at > NOW() - interval '7 days') AS mentioned7d,
      (SELECT count(*)::int FROM pal_opt_runs r WHERE r.project_id = pr.id AND r.error IS NOT NULL AND r.executed_at > NOW() - interval '7 days') AS errors7d,
      (SELECT max(r.executed_at) FROM pal_opt_runs r WHERE r.project_id = pr.id) AS last_run_at,
      (SELECT a.score FROM pal_opt_audits a WHERE a.project_id = pr.id ORDER BY a.run_at DESC LIMIT 1) AS audit_score
    FROM pal_opt_projects pr
    ORDER BY pr.id`;
  return rows.map((r) => ({
    projectId: Number(r.id),
    paletteId: String(r.palette_id),
    businessName: String(r.business_name),
    activePrompts: Number(r.active_prompts),
    runs7d: Number(r.runs7d),
    mentioned7d: Number(r.mentioned7d),
    errors7d: Number(r.errors7d),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    auditScore: r.audit_score === null ? null : Number(r.audit_score),
  }));
};

// ---------- Stats ----------

export type DailyStat = {
  day: string;
  engine: string;
  total: number;
  mentioned: number;
  cited: number;
};

export const getDailyStats = async (projectId: number, days = 30): Promise<DailyStat[]> => {
  await ensureTables();
  const { rows } = await sql`
    SELECT to_char(executed_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') AS day,
           engine,
           count(*)::int AS total,
           count(*) FILTER (WHERE mentioned)::int AS mentioned,
           count(*) FILTER (WHERE cited)::int AS cited
    FROM pal_opt_runs
    WHERE project_id = ${projectId}
      AND executed_at > NOW() - (${days} || ' days')::interval
      AND error IS NULL
    GROUP BY 1, 2
    ORDER BY 1, 2`;
  return rows.map((r) => ({
    day: String(r.day),
    engine: String(r.engine),
    total: Number(r.total),
    mentioned: Number(r.mentioned),
    cited: Number(r.cited),
  }));
};
