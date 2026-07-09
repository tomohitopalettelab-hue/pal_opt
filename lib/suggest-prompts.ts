/**
 * 観測プロンプト（お客さんがAIに聞きそうな質問）の自動生成。
 * サイトURLがある場合は実ページを読み取り、業種一般論ではなく
 * 「実際に提供しているサービス・メニュー・料金・悩み」に紐づいた質問を作る。
 */
import OpenAI from 'openai';
import type { Project } from './db';

export type SuggestedPrompt = { text: string; category: string };

export const PROMPT_CATEGORIES = ['認知', '比較', '地域', '購買'] as const;

const SUGGEST_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

/** サイト本文をテキスト化して取得（失敗時は空文字。生成は業種ベースにフォールバック） */
/** 既存HPの本文テキストを取得（ハブ自動入力からも共用） */
export const fetchSiteText = async (siteUrl: string): Promise<string> => {
  try {
    const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PalOptAudit/1.0; +https://pal-opt.vercel.app)' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const html = (await res.text()).slice(0, 400_000);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  } catch {
    return '';
  }
};

export const suggestPrompts = async (project: Project, count = 20): Promise<SuggestedPrompt[]> => {
  const siteText = project.siteUrl ? await fetchSiteText(project.siteUrl) : '';

  const res = await openai().chat.completions.create({
    model: SUGGEST_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAIO（AI検索最適化）の専門家です。以下の事業者について、見込み客が ChatGPT や Gemini などのAIに実際に入力しそうな「質問文」を${count}個、日本語で生成してください。

事業者情報:
- 名称: ${project.businessName}
- 業種: ${project.industry || '不明'}
- 商圏/地域: ${project.area || '不明'}
${siteText ? `- サイト本文（実際のサービス内容。ここから具体テーマを拾うこと）:\n${siteText}` : '- サイト情報なし'}

ルール:
- 質問文に事業者名は入れない（第三者としての自然な質問にする）
- **最重要**: ${siteText ? '質問の7割以上は、サイト本文に書かれている具体的なサービス・メニュー・料金・対応内容・顧客の悩みに紐づけること（例: サイトに「縮毛矯正」とあれば「縮毛矯正が上手い店は？」、「遺品整理」とあれば「遺品整理っていくらかかる？」）。業種名だけの一般論（「◯◯でおすすめは？」の量産）は3割まで' : '業種から想定される具体的なサービス・悩み・料金に踏み込むこと（一般論の量産は避ける）'}
- 地域カテゴリの質問には商圏の地名を自然に含める
- カテゴリを4種類に分ける: "認知"(〜とは/おすすめは)、"比較"(どこがいい/違いは/選び方)、"地域"(地域名を含む探し方)、"購買"(料金/失敗しないコツ/依頼前の不安)
- 口語で自然に。長すぎない一文
- JSON形式: {"prompts": [{"text": "...", "category": "認知"|"比較"|"地域"|"購買"}]}`,
      },
      { role: 'user', content: `${count}個生成してください。` },
    ],
    temperature: 0.8,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as {
      prompts?: Array<{ text?: string; category?: string }>;
    };
    const valid = new Set<string>(PROMPT_CATEGORIES as readonly string[]);
    return (parsed.prompts ?? [])
      .map((p) => ({
        text: String(p.text ?? '').trim(),
        category: valid.has(String(p.category)) ? String(p.category) : '認知',
      }))
      .filter((p) => p.text.length > 3)
      .slice(0, count);
  } catch {
    return [];
  }
};
