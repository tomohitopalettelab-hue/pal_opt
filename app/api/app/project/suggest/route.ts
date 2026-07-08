import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/session-server';

export const maxDuration = 60;

/**
 * POST: サイトURLからオンボーディング項目をAIで自動推定。
 * body: { siteUrl } → { businessName, industry, area, competitors[] }
 * ユーザーがフォームで修正してから送信する前提（そのままDBには保存しない）。
 */

const FETCH_TIMEOUT = 10_000;
const UA = 'Mozilla/5.0 (compatible; PalOptSuggest/1.0; +https://pal-opt.vercel.app)';
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

const fetchHtml = async (url: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status >= 400) return null;
    return (await res.text()).slice(0, 500_000);
  } catch {
    return null;
  }
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { siteUrl?: string };
  const raw = String(body.siteUrl || '').trim();
  if (!raw) return NextResponse.json({ success: false, error: 'サイトURLを入力してください。' }, { status: 400 });

  const siteUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    new URL(siteUrl);
  } catch {
    return NextResponse.json({ success: false, error: 'URLの形式が正しくありません。' }, { status: 400 });
  }

  const html = await fetchHtml(siteUrl);
  if (!html) {
    return NextResponse.json(
      { success: false, error: 'サイトを読み込めませんでした。URLをご確認ください。' },
      { status: 502 },
    );
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    '';
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 6000);

  try {
    const res = await openai().chat.completions.create({
      model: SUGGEST_MODEL,
      messages: [
        {
          role: 'system',
          content: `あなたは事業者サイトの分析アシスタントです。与えられたサイトの内容から、以下をJSONで推定してください。
- businessName: 事業者名・店舗名（サイト名から正式名称を推定。キャッチコピーは含めない）
- industry: 業種（例: 美容室、歯科医院、工務店。10文字以内）
- area: 商圏・地域（例: 渋谷・原宿、横浜市。住所や対応エリアの記載から。読み取れなければ空文字）
- competitors: 同地域・同業種の競合になりそうな事業者名の配列（サイト内に記載があるもの、または一般によく知られているもの。確信が持てなければ空配列。最大5件）
出力形式: {"businessName": "...", "industry": "...", "area": "...", "competitors": ["..."]}`,
        },
        {
          role: 'user',
          content: `サイトURL: ${siteUrl}
ページタイトル: ${title || '（なし）'}
メタディスクリプション: ${metaDesc || '（なし）'}
本文抜粋:
${textOnly}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as {
      businessName?: string;
      industry?: string;
      area?: string;
      competitors?: unknown[];
    };
    return NextResponse.json({
      success: true,
      suggestion: {
        businessName: String(parsed.businessName ?? '').trim(),
        industry: String(parsed.industry ?? '').trim(),
        area: String(parsed.area ?? '').trim(),
        competitors: Array.isArray(parsed.competitors)
          ? parsed.competitors.map((c) => String(c).trim()).filter(Boolean).slice(0, 5)
          : [],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '推定に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
