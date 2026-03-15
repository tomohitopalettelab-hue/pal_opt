import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getSettingsByPaletteId, updatePost } from '../_lib/pal-opt-store';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  const status = (error as Record<string, unknown>)?.status as number | undefined;
  if (status === 429 || status === 500 || status === 503) return true;
  const message = String((error as Record<string, unknown>)?.message || '').toLowerCase();
  return message.includes('rate limit') || message.includes('overloaded') || message.includes('timeout');
};

const extractErrorMessage = (error: unknown): string => {
  const status = (error as Record<string, unknown>)?.status;
  const raw = String((error as Record<string, unknown>)?.message || '不明なエラー');
  const compact = raw.replace(/\s+/g, ' ').trim();
  return status ? `[${status}] ${compact}` : compact;
};

type GenerateBody = {
  postId: string;
  title: string;
  topic: string;
  keywords: string[];
  targetAudience?: string;
  imageUrls?: string[];
};

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);
    if (!session || session.role !== 'customer' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const paletteId = session.customerId || '';
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const body = (await req.json()) as GenerateBody;
    const postId = String(body.postId || '').trim();
    const title = String(body.title || '').trim();
    const topic = String(body.topic || '').trim();
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    const targetAudience = String(body.targetAudience || '');
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];

    if (!title && !topic) {
      return NextResponse.json({ success: false, error: 'タイトルまたはトピックを入力してください。' }, { status: 400 });
    }

    const settings = await getSettingsByPaletteId(paletteId);

    const toneMap: Record<string, string> = {
      professional: 'プロフェッショナルで信頼感のある',
      casual: 'カジュアルで親しみやすい',
      friendly: 'フレンドリーで温かみのある',
    };
    const toneLabel = toneMap[settings?.defaultTone || 'professional'] || 'プロフェッショナルで信頼感のある';

    let contextAddendum = '';
    if (settings?.hasPalStudio) {
      contextAddendum += `
【pal_studio連携】
この顧客はWebサイト（pal_studio）を運用しています。
ブログ記事はWebサイトへの流入を意識し、内部リンクや関連ページへの誘導を含めてください。
HTML記事は本文構造で、h2/h3見出し、p段落、強調などを適切に使用してください。`;
    }
    if (settings?.hasPalTrust) {
      contextAddendum += `
【pal_trust連携】
この顧客はGoogleビジネスプロフィールの口コミ管理（pal_trust）を行っています。
GBP投稿はMEOを意識し、地域名・サービス名・検索キーワードを自然に含めてください。
口コミで評価されている点を強化するトーンにしてください。`;
    }

    const systemPrompt = `あなたはSEO・MEO・AIOに精通したデジタルマーケティングの専門家です。
入力された情報をもとに、3つのプラットフォーム向けのコンテンツを同時に生成します。
必ずJSON形式のみで回答し、それ以外のテキストは一切含めないでください。${contextAddendum}`;

    const userPrompt = `以下の情報をもとに、コンテンツを生成してください。

【基本情報】
- タイトル/トピック: ${title || topic}
- キーワード: ${keywords.length > 0 ? keywords.join(', ') : '（なし）'}
- ターゲット層: ${targetAudience || '（未指定）'}
- トーン: ${toneLabel}
- 重点キーワード: ${settings?.targetKeywords?.join(', ') || '（なし）'}
- 目標・方針: ${settings?.goals || '（なし）'}
${imageUrls.length > 0 ? `- 画像URL数: ${imageUrls.length}枚（最初の画像をInstagramに使用してください）` : ''}

以下のJSON形式で回答してください（コードブロック不要、JSONのみ）:
{
  "instagram": {
    "caption": "Instagram投稿文（最大2200文字、改行あり、ハッシュタグを末尾に配置）",
    "hashTags": ["#タグ1", "#タグ2", "#タグ3"]
  },
  "blog": {
    "title": "SEO最適化されたブログ記事タイトル（30〜60文字）",
    "bodyHtml": "<article>...</article>（完全なHTML、見出し・段落・強調を含む、1500〜2000文字相当）",
    "metaDescription": "メタディスクリプション（120〜160文字）",
    "slug": "url-friendly-slug-in-japanese-romaji"
  },
  "gbp": {
    "summary": "Googleビジネスプロフィールの最新情報テキスト（200〜1500文字、地域・サービス名を含む）",
    "callToAction": "ウェブサイトを見る"
  }
}`;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const openai = new OpenAI({ apiKey });

    let responseText: string | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        responseText = completion.choices[0]?.message?.content || '';
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === 3) break;
        await sleep(500 * attempt);
      }
    }

    if (!responseText) {
      throw lastError || new Error('モデルからのレスポンスを取得できませんでした');
    }

    // JSON パース
    let generated: {
      instagram: { caption: string; hashTags: string[] };
      blog: { title: string; bodyHtml: string; metaDescription: string; slug: string };
      gbp: { summary: string; callToAction: string };
    };

    try {
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      generated = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { success: false, error: 'AIの応答をパースできませんでした。もう一度お試しください。' },
        { status: 500 },
      );
    }

    // Instagram: 最初の画像URLを設定
    const igImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
    const igCaption = `${generated.instagram.caption}\n\n${generated.instagram.hashTags.join(' ')}`;

    // 投稿レコードに生成内容を保存
    if (postId) {
      await updatePost(postId, {
        status: 'preview',
        instagramCaption: igCaption,
        instagramImageUrl: igImageUrl,
        blogTitle: generated.blog.title,
        blogBodyHtml: generated.blog.bodyHtml,
        blogSlug: generated.blog.slug,
        gbpSummary: generated.gbp.summary,
        gbpCallToAction: generated.gbp.callToAction,
      });
    }

    return NextResponse.json({
      success: true,
      instagram: {
        caption: igCaption,
        imageUrl: igImageUrl,
      },
      blog: {
        title: generated.blog.title,
        bodyHtml: generated.blog.bodyHtml,
        metaDescription: generated.blog.metaDescription,
        slug: generated.blog.slug,
      },
      gbp: {
        summary: generated.gbp.summary,
        callToAction: generated.gbp.callToAction,
      },
    });
  } catch (error: unknown) {
    console.error('--- pal_opt generate エラー ---', error);
    return NextResponse.json(
      { success: false, error: `生成エラー: ${extractErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
