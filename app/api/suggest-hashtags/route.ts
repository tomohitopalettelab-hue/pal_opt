import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';

/**
 * POST /api/suggest-hashtags
 * トピック/キーワードから最適なハッシュタグを提案
 */
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);
    if (!session || session.role !== 'customer' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const body = await req.json();
    const topic = String(body.topic || '').trim();
    const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : [];
    const platform = String(body.platform || 'instagram').trim();
    const existingTags: string[] = Array.isArray(body.existingTags) ? body.existingTags : [];

    if (!topic && keywords.length === 0) {
      return NextResponse.json({ success: false, error: 'トピックまたはキーワードを入力してください。' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `以下の情報をもとに、${platform === 'x' ? 'X (Twitter)' : 'Instagram'} 向けの最適なハッシュタグを提案してください。

【トピック】${topic}
【キーワード】${keywords.join(', ') || '（なし）'}
${existingTags.length > 0 ? `【既存タグ（重複しないように）】${existingTags.join(', ')}` : ''}

以下のJSON形式で回答してください:
{
  "trending": ["人気/トレンド系のタグ 5〜8個"],
  "niche": ["ニッチ/専門系のタグ 5〜8個（競合が少なく狙いやすい）"],
  "brand": ["ブランディング/独自タグの提案 2〜3個"],
  "recommended": ["上記から特におすすめの組み合わせ 8〜12個"]
}

ハッシュタグは全て日本語で、# 付きで回答してください。`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'あなたはSNSマーケティングのハッシュタグ戦略の専門家です。必ずJSON形式のみで回答してください。' },
        { role: 'user', content: prompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let result: {
      trending: string[];
      niche: string[];
      brand: string[];
      recommended: string[];
    };

    try {
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ success: false, error: 'ハッシュタグの生成に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hashtags: result,
    });
  } catch (error: unknown) {
    console.error('--- pal_opt suggest-hashtags エラー ---', error);
    const message = error instanceof Error ? error.message : 'ハッシュタグ提案に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
