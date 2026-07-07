/**
 * 観測プロンプト（お客さんがAIに聞きそうな質問）の自動生成。
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

export const suggestPrompts = async (project: Project, count = 20): Promise<SuggestedPrompt[]> => {
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
- サイト: ${project.siteUrl || 'なし'}

ルール:
- 質問文に事業者名は入れない（第三者としての自然な質問にする）
- カテゴリを4種類に分ける: "認知"(〜とは/おすすめは)、"比較"(どこがいい/違いは)、"地域"(地域名を含む探し方)、"購買"(料金/選び方/失敗しないコツ)
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
