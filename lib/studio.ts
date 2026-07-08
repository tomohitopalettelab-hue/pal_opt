/**
 * Pal Studio連携: 改善タスクからAIが記事を書き、Studioのブログへ「下書き」として送稿する。
 * Studio側の受け口は旧pal_opt時代からある POST /api/admin/posts（x-studio-admin-key認証）。
 * 公開はStudio側で人間が確認してから行う前提（自動公開はしない）。
 */
import OpenAI from 'openai';
import type { HubData, Project } from './db';

const ARTICLE_MODEL = process.env.ACTIONS_MODEL || 'gpt-4o';

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

export type GeneratedArticle = { title: string; bodyHtml: string; tags: string[] };

/** 改善タスク（コンテンツ施策/FAQ）からAIO最適化記事を生成 */
export const generateArticle = async (
  project: Project,
  topic: { title: string; description: string; deliverable?: string | null },
  missedPrompts: Array<{ text: string }>,
): Promise<GeneratedArticle> => {
  const res = await openai().chat.completions.create({
    model: ARTICLE_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAIO（AI検索最適化）に強いコンテンツライターです。以下の事業者のブログ記事を書いてください。

事業者: ${project.businessName}（${[project.industry, project.area].filter(Boolean).join(' / ')}）

AIOライティングのルール:
- 冒頭の1段落で結論・要点を先出し（AIが引用しやすい）
- 見出し(h2/h3)で構造化し、可能な箇所はQ&A形式にする
- 具体的な数値・手順・チェックリストを含める（一般論で終わらせない）
- 記事内で1〜2回、自然な文脈で事業者名に触れる（宣伝臭くしない）
- 事実の捏造をしない。料金など不明な事実は「◯◯」とプレースホルダにする
- 1,200〜2,000文字。本文はHTML（h2/h3/p/ul/li/strongのみ使用、head/bodyタグ不要）
- JSON形式で出力: {"title": "...", "bodyHtml": "...", "tags": ["...", "..."]}（tagsは3〜5個）`,
      },
      {
        role: 'user',
        content: `記事化する施策: ${topic.title}
施策の意図: ${topic.description}
${topic.deliverable ? `参考素材:\n${topic.deliverable.slice(0, 3000)}` : ''}
参考: AIに実際に聞かれている質問（記事で答えられると効果的）:
${missedPrompts.slice(0, 5).map((m) => `- ${m.text}`).join('\n') || '（なし）'}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as Partial<GeneratedArticle>;
    const title = String(parsed.title ?? '').trim();
    const bodyHtml = String(parsed.bodyHtml ?? '').trim();
    if (!title || !bodyHtml) throw new Error('empty');
    return {
      title,
      bodyHtml,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
    };
  } catch {
    throw new Error('記事の生成に失敗しました。もう一度お試しください。');
  }
};

/** Studioへ下書きとして送稿 */
export const publishDraftToStudio = async (
  paletteId: string,
  article: GeneratedArticle,
  sourceId: string,
): Promise<void> => {
  const origin = (process.env.PAL_STUDIO_ORIGIN || '').replace(/\/$/, '');
  const apiKey = process.env.PAL_STUDIO_ADMIN_API_KEY || '';
  if (!origin || !apiKey) throw new Error('Pal Studioの接続設定（PAL_STUDIO_ORIGIN / PAL_STUDIO_ADMIN_API_KEY）がありません。');

  const res = await fetch(`${origin}/api/admin/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-studio-admin-key': apiKey },
    body: JSON.stringify({
      paletteId,
      post: {
        id: `palopt-aio-${sourceId}`,
        title: article.title,
        slug: '',
        bodyHtml: article.bodyHtml,
        excerpt: '',
        status: 'draft',
        postType: 'blog',
        tags: article.tags,
        publishedAt: '',
        imageUrl: '',
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Studioへの送稿に失敗しました (${res.status})`);
  }
};

// ---------- AIOハブページ（Studioホストの1枚ページ） ----------

const studioConfig = (): { origin: string; apiKey: string; publicOrigin: string } => {
  const origin = (process.env.PAL_STUDIO_ORIGIN || '').replace(/\/$/, '');
  const apiKey = process.env.PAL_STUDIO_ADMIN_API_KEY || '';
  if (!origin || !apiKey) throw new Error('Pal Studioの接続設定（PAL_STUDIO_ORIGIN / PAL_STUDIO_ADMIN_API_KEY）がありません。');
  const publicOrigin = (process.env.PAL_STUDIO_PUBLIC_ORIGIN || origin).replace(/\/$/, '');
  return { origin, apiKey, publicOrigin };
};

/** ハブページの公開URL（Studio側ドメイン・モデルA）。pal_studio_v2 の /hub/{paletteId} */
export const hubPublicUrl = (paletteId: string): string => {
  const { publicOrigin } = studioConfig();
  return `${publicOrigin}/hub/${encodeURIComponent(paletteId)}`;
};

/**
 * ハブページをStudioへupsert（作成/更新/無効化はすべてここを通す）。
 * Studio側の受け口は POST /api/admin/aio-hub（x-studio-admin-key認証）。
 */
export const upsertHubToStudio = async (
  project: Project,
  hub: HubData,
  enabled: boolean,
): Promise<{ hubUrl: string }> => {
  const { origin, apiKey } = studioConfig();
  const res = await fetch(`${origin}/api/admin/aio-hub`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-studio-admin-key': apiKey },
    body: JSON.stringify({
      paletteId: project.paletteId,
      enabled,
      hub: {
        ...hub,
        industry: project.industry || '',
        area: project.area || '',
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Studioへのハブ反映に失敗しました (${res.status})`);
  }
  return { hubUrl: hubPublicUrl(project.paletteId) };
};

export type HubFaqDraft = { question: string; answer: string; sourcePrompt: string | null };

/**
 * 「AIに言及されなかった質問」に正面から答えるQ&A案を生成（構造化）。
 * actions-gen.ts の FAQ生成と同じ思想: ハブのFAQに追記する受け皿を作る。
 */
export const generateHubFaqDrafts = async (
  project: Project,
  missedPrompts: Array<{ text: string }>,
  existingQuestions: string[],
  maxItems = 6,
): Promise<HubFaqDraft[]> => {
  const questions = missedPrompts.slice(0, maxItems).map((m) => m.text);
  if (questions.length === 0) return [];

  const res = await openai().chat.completions.create({
    model: ARTICLE_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAIO（AI検索最適化）のコンテンツライターです。以下の事業者のFAQページに追記するQ&Aを作ってください。

事業者: ${project.businessName}（${[project.industry, project.area].filter(Boolean).join(' / ')}）

要件:
- 与えられた「AIに聞かれている質問」に正面から答えるQ&Aを作る（質問はサイト訪問者向けに自然な表現へ言い換えてよい）
- 各回答は結論先出し・2〜4文・具体的（一般論で終わらせず、この事業者を選ぶ理由が伝わるように。ただし誇大表現や事実の捏造はしない。料金など不明な事実は「◯◯」とプレースホルダにする）
- 既存FAQと重複する質問は出さない。既存: ${existingQuestions.slice(0, 30).join(' / ') || 'なし'}
- 出力はJSON: {"faqs": [{"q": "...", "a": "...", "source": "元になったAIへの質問"}]}`,
      },
      { role: 'user', content: `AIに聞かれている質問:\n${questions.map((q) => `- ${q}`).join('\n')}` },
    ],
    temperature: 0.6,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as {
      faqs?: Array<{ q?: string; a?: string; source?: string }>;
    };
    return (parsed.faqs ?? [])
      .map((f) => ({
        question: String(f.q ?? '').trim(),
        answer: String(f.a ?? '').trim(),
        sourcePrompt: String(f.source ?? '').trim() || null,
      }))
      .filter((f) => f.question && f.answer)
      .slice(0, maxItems);
  } catch {
    return [];
  }
};
