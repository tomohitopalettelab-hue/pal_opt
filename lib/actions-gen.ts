/**
 * 改善タスクの自動生成。
 * 診断で落ちた項目（機械的に成果物を組み立てられるもの）＋
 * 「AIに言及されなかった質問」からのコンテンツ提案（LLM）を組み合わせる。
 * 成果物(deliverable)は「そのまま貼れる/使える」形で出すのが原則。
 */
import OpenAI from 'openai';
import type { Project } from './db';
import type { AuditCheck } from './audit';

export type GeneratedAction = {
  category: string; // structured_data | faq | robots | meta | content | other
  title: string;
  description: string;
  deliverable?: string | null;
};

const ACTIONS_MODEL = process.env.ACTIONS_MODEL || 'gpt-4o';

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

const failed = (checks: AuditCheck[], key: string): boolean =>
  checks.some((c) => c.key === key && c.passed === false);

/** LocalBusiness JSON-LD（貼るだけコード）をプロジェクト情報から組み立て */
const buildLocalBusinessJsonLd = (project: Project): string => {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: project.businessName,
    url: project.siteUrl || undefined,
    description: `${project.area ? project.area + 'の' : ''}${project.industry || '事業者'}「${project.businessName}」`,
    address: project.area
      ? { '@type': 'PostalAddress', addressLocality: project.area, addressCountry: 'JP' }
      : undefined,
  };
  const json = JSON.stringify(ld, null, 2);
  return `<!-- ▼ このままHTMLの<head>内に貼り付けてください。住所・電話番号・営業時間は実情報に書き換えると効果が上がります -->
<script type="application/ld+json">
${json}
</script>`;
};

const robotsFixDeliverable = (checks: AuditCheck[]): string => {
  const blockedBots = checks
    .filter((c) => c.key.startsWith('robots_') && c.passed === false)
    .map((c) => c.label.replace('AIクローラー許可: ', ''));
  return `ブロック中: ${blockedBots.join(', ')}

robots.txt から該当ボットの「Disallow: /」を削除するか、以下のように明示的に許可してください:

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /`;
};

/**
 * FAQ文案＋FAQPage JSON-LD をLLMで生成。
 * 「AIに言及されなかった質問」に正面から答えるQ&Aを作る＝次回計測で拾われる受け皿。
 */
const generateFaqDeliverable = async (
  project: Project,
  missedPrompts: Array<{ text: string; misses: number }>,
): Promise<string | null> => {
  const questions = missedPrompts.slice(0, 6).map((m) => m.text);
  if (questions.length === 0) return null;

  const res = await openai().chat.completions.create({
    model: ACTIONS_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAIO（AI検索最適化）のコンテンツライターです。以下の事業者のFAQページ文案を作ってください。

事業者: ${project.businessName}（${[project.industry, project.area].filter(Boolean).join(' / ')}）

要件:
- 与えられた「AIに聞かれている質問」に正面から答えるQ&Aを作る（質問はサイト訪問者向けに自然な表現へ言い換えてよい）
- 各回答は結論先出し・2〜4文・具体的（一般論で終わらせず、この事業者を選ぶ理由が伝わるように。ただし誇大表現や事実の捏造はしない。料金など不明な事実は「◯◯」とプレースホルダにする）
- 出力はJSON: {"faqs": [{"q": "...", "a": "..."}]}`,
      },
      { role: 'user', content: `AIに聞かれている質問:\n${questions.map((q) => `- ${q}`).join('\n')}` },
    ],
    temperature: 0.6,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  let faqs: Array<{ q: string; a: string }> = [];
  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as { faqs?: Array<{ q?: string; a?: string }> };
    faqs = (parsed.faqs ?? [])
      .map((f) => ({ q: String(f.q ?? '').trim(), a: String(f.a ?? '').trim() }))
      .filter((f) => f.q && f.a);
  } catch {
    return null;
  }
  if (faqs.length === 0) return null;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return `【FAQページ文案】そのままFAQページ/セクションとして掲載できます（「◯◯」は実情報に置き換え）:

${faqs.map((f, i) => `Q${i + 1}. ${f.q}\nA. ${f.a}`).join('\n\n')}

【FAQPage 構造化データ】上のFAQを掲載したページの<head>に貼り付けてください:

<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>`;
};

/** 言及されなかった質問からのコンテンツ施策提案（LLM） */
const generateContentActions = async (
  project: Project,
  missedPrompts: Array<{ text: string; misses: number }>,
  auditSummary: string,
  existingTitles: string[],
): Promise<GeneratedAction[]> => {
  const res = await openai().chat.completions.create({
    model: ACTIONS_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはAIO（AI検索最適化）コンサルタントです。事業者がAI検索（ChatGPT/Gemini等）の回答で言及されるようになるための改善施策を提案してください。

事業者: ${project.businessName}（${[project.industry, project.area].filter(Boolean).join(' / ')}、サイト: ${project.siteUrl || 'なし'}）
サイト診断の要点: ${auditSummary || '未診断'}

ルール:
- サイト内部の技術修正（構造化データ・サイトマップ・メタタグ・FAQページ新設など）は**提案しない**。それらは別タスクで対応済み。あなたの担当は「サイトの外」と「コンテンツの中身」: 具体的なテーマの特集ページ/記事、Googleビジネスプロフィールの投稿・情報整備、口コミ促進の仕掛け、地域メディア・業界ポータル・比較サイトへの掲載獲得など（AIは第三者ソースを引用しやすい）
- 既存タスクと重複しないこと。既存: ${existingTitles.join(' / ') || 'なし'}
- 「AIに言及されなかった質問」のテーマを名指しで拾う（例:「◯◯について解説する特集ページを作る」）
- 各施策は1〜2週間で実行できる粒度。タイトルは動詞で終わる指示形。descriptionには「なぜAIOに効くか」を1文含める
- 最大4件。JSON: {"actions": [{"category": "content", "title": "...", "description": "..."}]}`,
      },
      {
        role: 'user',
        content: `AIに言及されなかった質問（直近14日）:\n${missedPrompts.map((m) => `- ${m.text}（${m.misses}回）`).join('\n') || '（まだ計測データなし）'}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as {
      actions?: Array<{ category?: string; title?: string; description?: string }>;
    };
    return (parsed.actions ?? [])
      .map((a) => ({
        category: 'content',
        title: String(a.title ?? '').trim(),
        description: String(a.description ?? '').trim(),
      }))
      .filter((a) => a.title)
      .slice(0, 4);
  } catch {
    return [];
  }
};

export const generateActions = async (
  project: Project,
  auditChecks: AuditCheck[],
  missedPrompts: Array<{ text: string; misses: number }>,
): Promise<GeneratedAction[]> => {
  const actions: GeneratedAction[] = [];

  // 1. 機械的に成果物を組み立てられるもの（LLM不要・確実）
  if (failed(auditChecks, 'jsonld_localbusiness') || failed(auditChecks, 'jsonld_present')) {
    actions.push({
      category: 'structured_data',
      title: '事業者情報の構造化データ（JSON-LD）をサイトに追加する',
      description: 'AIがサイトから事業者名・所在地・業種を機械的に読み取れるようになり、引用の土台になります。<head>内に貼るだけです。',
      deliverable: buildLocalBusinessJsonLd(project),
    });
  }
  if (auditChecks.some((c) => c.key.startsWith('robots_') && c.passed === false)) {
    actions.push({
      category: 'robots',
      title: 'robots.txt のAIクローラーブロックを解除する',
      description: 'AIのクローラーがブロックされているとサイトが読まれず、引用対象になりません。最優先の修正です。',
      deliverable: robotsFixDeliverable(auditChecks),
    });
  }
  for (const key of ['title', 'meta_description', 'h1', 'freshness', 'nap_phone', 'nap_address', 'sitemap'] as const) {
    const check = auditChecks.find((c) => c.key === key && c.passed === false);
    if (check) {
      actions.push({
        category: 'meta',
        title: `${check.label}を改善する`,
        description: `${check.detail} ${check.howToFix ?? ''}`.trim(),
      });
    }
  }

  // 2. FAQ（言及されなかった質問への受け皿）— LLM生成
  if (missedPrompts.length > 0) {
    const faq = await generateFaqDeliverable(project, missedPrompts).catch(() => null);
    if (faq) {
      actions.push({
        category: 'faq',
        title: 'AIに聞かれている質問に答えるFAQページを追加する',
        description:
          '実際にAIへ投げられている質問のうち、あなたが言及されなかったものに正面から答えるQ&Aです。Q&A構造はAIが最も引用しやすい形式で、次回以降の計測で拾われる受け皿になります。',
        deliverable: faq,
      });
    }
  }

  // 3. コンテンツ・外部施策の提案 — LLM生成
  const auditSummary = auditChecks
    .filter((c) => c.passed === false)
    .map((c) => c.label)
    .slice(0, 8)
    .join('、');
  const contentActions = await generateContentActions(
    project,
    missedPrompts,
    auditSummary,
    actions.map((a) => a.title),
  ).catch(() => []);
  actions.push(...contentActions);

  return actions;
};
