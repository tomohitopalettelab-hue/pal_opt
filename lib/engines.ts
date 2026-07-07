/**
 * AI検索エンジンへの計測クエリ実行。
 * MVP構成: Gemini(Google Search grounding・無料枠) + ChatGPT(検索なし・素のモデル知識)。
 * Phase 2で DataForSEO(AI Overview)・Perplexity・OpenAI web_search を追加予定。
 */
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { Citation } from './db';

export type EngineResult = {
  answerText: string;
  citations: Citation[];
};

export const ENGINES = ['gemini', 'chatgpt'] as const;
export type Engine = (typeof ENGINES)[number];

export const ENGINE_LABELS: Record<Engine, string> = {
  gemini: 'Gemini（Google検索接地）',
  chatgpt: 'ChatGPT（モデル知識）',
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let _gemini: GoogleGenAI | null = null;
const gemini = (): GoogleGenAI => {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
};

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

export const runGemini = async (promptText: string): Promise<EngineResult> => {
  const res = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: promptText,
    config: { tools: [{ googleSearch: {} }] },
  });
  const answerText = res.text ?? '';
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const citations: Citation[] = chunks
    .map((c) => ({
      title: String(c.web?.title ?? ''),
      uri: String(c.web?.uri ?? ''),
    }))
    .filter((c) => c.title || c.uri);
  return { answerText, citations };
};

export const runChatGpt = async (promptText: string): Promise<EngineResult> => {
  const res = await openai().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'あなたは日本のユーザーの質問に答えるアシスタントです。おすすめや比較を聞かれたら、知っている範囲で具体的な店名・会社名・サービス名を挙げて答えてください。',
      },
      { role: 'user', content: promptText },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });
  return {
    answerText: res.choices?.[0]?.message?.content ?? '',
    citations: [],
  };
};

export const runEngine = async (engine: Engine, promptText: string): Promise<EngineResult> => {
  if (engine === 'gemini') return runGemini(promptText);
  return runChatGpt(promptText);
};
