/**
 * AI回答の解析: 自社言及・言及順位・センチメント・競合言及を軽量LLMで判定し、
 * 引用URLから自社サイト引用の有無を機械判定する。
 */
import OpenAI from 'openai';
import type { Citation, Project } from './db';

export type Analysis = {
  mentioned: boolean;
  mentionPosition: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  competitorsMentioned: string[];
  cited: boolean;
};

const ANALYZE_MODEL = process.env.ANALYZE_MODEL || 'gpt-4o-mini';

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

const hostOf = (url: string): string => {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

/** 引用元に自社ドメインが含まれるか（Geminiのgrounding titleはドメイン名なので両方見る） */
export const isSiteCited = (siteUrl: string | null, citations: Citation[]): boolean => {
  if (!siteUrl) return false;
  const own = hostOf(siteUrl);
  if (!own) return false;
  return citations.some((c) => {
    const t = (c.title || '').replace(/^www\./, '').toLowerCase();
    const u = hostOf(c.uri || '');
    return t === own || t.endsWith(`.${own}`) || u === own || u.endsWith(`.${own}`);
  });
};

export const analyzeAnswer = async (project: Project, answerText: string, citations: Citation[]): Promise<Analysis> => {
  const cited = isSiteCited(project.siteUrl, citations);

  if (!answerText.trim()) {
    return { mentioned: false, mentionPosition: null, sentiment: null, competitorsMentioned: [], cited };
  }

  const names = [project.businessName, ...project.businessAliases].filter(Boolean);
  const res = await openai().chat.completions.create({
    model: ANALYZE_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAI回答の分析器です。与えられた「AIの回答文」を分析し、指定されたJSONだけを返してください。

分析対象の自社: ${JSON.stringify(names)}
競合リスト: ${JSON.stringify(project.competitors)}

判定ルール:
- mentioned: 回答文の中で自社（表記ゆれ・略称含む）が紹介・言及されていれば true
- mentionPosition: 回答内で店名/会社名/サービス名が列挙されている場合、自社が何番目に登場するか(1始まり)。言及なしなら null
- sentiment: 自社への言及のトーン。"positive" | "neutral" | "negative"。言及なしなら null
- competitorsMentioned: 回答に登場した競合リスト内の名前の配列（リスト外は含めない）

JSON形式: {"mentioned": boolean, "mentionPosition": number|null, "sentiment": string|null, "competitorsMentioned": string[]}`,
      },
      { role: 'user', content: answerText.slice(0, 6000) },
    ],
    temperature: 0,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as Partial<Analysis>;
    const sentiment =
      parsed.sentiment === 'positive' || parsed.sentiment === 'neutral' || parsed.sentiment === 'negative'
        ? parsed.sentiment
        : null;
    return {
      mentioned: Boolean(parsed.mentioned),
      mentionPosition:
        typeof parsed.mentionPosition === 'number' && parsed.mentionPosition > 0
          ? Math.floor(parsed.mentionPosition)
          : null,
      sentiment: parsed.mentioned ? sentiment : null,
      competitorsMentioned: Array.isArray(parsed.competitorsMentioned)
        ? parsed.competitorsMentioned.map((s) => String(s)).slice(0, 20)
        : [],
      cited,
    };
  } catch {
    return { mentioned: false, mentionPosition: null, sentiment: null, competitorsMentioned: [], cited };
  }
};
