import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getSettingsByPaletteId, createPost, createPlan, listTemplates } from '../_lib/pal-opt-store';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PlanBody = {
  month: string;          // "2026-04"
  frequency: string;      // "3x/week" | "daily" | "2x/week" | "1x/week"
  topics: string[];       // テーマリスト
  platforms: string[];    // ["instagram", "blog", "gbp", "x"]
  templateIds?: string[]; // 使用するテンプレートID
};

const frequencyToCount = (freq: string, month: string): number => {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const weeksInMonth = Math.ceil(daysInMonth / 7);

  const match = freq.match(/^(\d+)x\/week$/);
  if (match) return Number(match[1]) * weeksInMonth;
  if (freq === 'daily') return daysInMonth;
  if (freq === '1x/week') return weeksInMonth;
  if (freq === '2x/week') return weeksInMonth * 2;
  return weeksInMonth * 3; // default 3x/week
};

/**
 * POST /api/generate-plan
 * 1ヶ月分の投稿計画を AI で一括生成
 */
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

    const body = (await req.json()) as PlanBody;
    const month = String(body.month || '').trim();
    const frequency = String(body.frequency || '3x/week').trim();
    const topics: string[] = Array.isArray(body.topics) ? body.topics : [];
    const platforms: string[] = Array.isArray(body.platforms) ? body.platforms : ['instagram', 'blog', 'gbp'];
    const templateIds: string[] = Array.isArray(body.templateIds) ? body.templateIds : [];

    if (!month.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json({ success: false, error: '月は YYYY-MM 形式で指定してください。' }, { status: 400 });
    }

    const postCount = frequencyToCount(frequency, month);
    const settings = await getSettingsByPaletteId(paletteId);

    // テンプレート情報の取得
    let templateContext = '';
    if (templateIds.length > 0) {
      const templates = await listTemplates(paletteId);
      const selected = templates.filter((t) => templateIds.includes(t.id));
      if (selected.length > 0) {
        templateContext = `\n【参考テンプレート】\n${selected.map((t) => `- ${t.name}: ${t.topic || ''} (トーン: ${t.tone || 'professional'})`).join('\n')}`;
      }
    }

    const prompt = `以下の条件で${month}の投稿計画を${postCount}件分作成してください。

【条件】
- テーマ: ${topics.length > 0 ? topics.join(', ') : '（自由）'}
- 投稿先: ${platforms.join(', ')}
- 業種/目標: ${settings?.goals || '（未設定）'}
- 重点キーワード: ${settings?.targetKeywords?.join(', ') || '（未設定）'}${templateContext}

各投稿について以下のJSON配列で回答してください:
[
  {
    "title": "投稿タイトル（20〜40文字）",
    "topic": "投稿のメイントピック",
    "keywords": ["キーワード1", "キーワード2", "キーワード3"],
    "suggestedDate": "YYYY-MM-DD",
    "suggestedTime": "HH:mm",
    "targetAudience": "ターゲット層"
  }
]

注意:
- 日付は${month}の範囲内で均等に配置
- 投稿時間は各プラットフォームのベストタイムを考慮（12:00, 18:00, 20:00 等）
- テーマを変化させ、マンネリにならないように
- 季節感やトレンドを意識
- JSON配列のみで回答（コードブロック不要）`;

    const openai = new OpenAI({ apiKey });

    let responseText: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'あなたはSNSマーケティングの投稿計画の専門家です。必ずJSON形式のみで回答してください。トップレベルのキーを "posts" としてJSON配列を含めてください。' },
            { role: 'user', content: prompt },
          ],
        });
        responseText = completion.choices[0]?.message?.content || '';
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await sleep(500 * attempt);
      }
    }

    if (!responseText) {
      return NextResponse.json({ success: false, error: '投稿計画の生成に失敗しました。' }, { status: 500 });
    }

    let planItems: Array<{
      title: string;
      topic: string;
      keywords: string[];
      suggestedDate: string;
      suggestedTime: string;
      targetAudience?: string;
    }>;

    try {
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      planItems = Array.isArray(parsed) ? parsed : (parsed.posts || parsed.plan || []);
    } catch {
      return NextResponse.json({ success: false, error: 'AI応答のパースに失敗しました。もう一度お試しください。' }, { status: 500 });
    }

    if (!Array.isArray(planItems) || planItems.length === 0) {
      return NextResponse.json({ success: false, error: '投稿計画が空です。' }, { status: 500 });
    }

    // Plan レコード作成
    const plan = await createPlan({
      paletteId,
      month,
      frequency,
      themes: topics,
      platforms,
      postCount: planItems.length,
    });

    // 各投稿を draft として作成
    const createdPosts = [];
    for (const item of planItems) {
      const scheduledAt = item.suggestedDate && item.suggestedTime
        ? `${item.suggestedDate}T${item.suggestedTime}:00+09:00`
        : null;

      const post = await createPost(paletteId, {
        title: item.title || '',
        topic: item.topic || '',
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        targetAudience: item.targetAudience || null,
        status: 'draft',
        scheduledAt,
        planId: plan.id,
      });
      createdPosts.push(post);
    }

    return NextResponse.json({
      success: true,
      plan,
      posts: createdPosts,
      count: createdPosts.length,
    });
  } catch (error: unknown) {
    console.error('--- pal_opt generate-plan エラー ---', error);
    const message = error instanceof Error ? error.message : '投稿計画の生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
