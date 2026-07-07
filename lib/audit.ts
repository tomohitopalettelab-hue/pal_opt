/**
 * サイトAIO診断: 顧客サイトをクロールし「AIに引用されやすい状態か」を項目別にチェックしてスコア化。
 * 根拠: Google公式ガイド(2026-05)=基本はSEO+構造化データ、AIクローラーのブロック解除、
 * 結論先出しのQ&A構造、更新日の明示、第三者言及。
 */
import type { Project } from './db';

export type AuditCheck = {
  key: string;
  label: string;
  /** true=OK / false=要改善 / null=判定不能(スコア対象外) */
  passed: boolean | null;
  weight: number;
  detail: string;
  howToFix?: string;
};

export type AuditResult = {
  score: number; // 0-100
  checks: AuditCheck[];
  fetchedUrl: string | null;
  error?: string;
};

const FETCH_TIMEOUT = 12_000;
const UA = 'Mozilla/5.0 (compatible; PalOptAudit/1.0; +https://pal-opt.vercel.app)';

const fetchText = async (url: string): Promise<{ status: number; text: string; finalUrl: string } | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 800_000), finalUrl: res.url };
  } catch {
    return null;
  }
};

/** robots.txt から特定UAグループの `Disallow: /` を検出（簡易パーサ） */
const isBotBlocked = (robotsTxt: string, botName: string): boolean => {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  let applies = false;
  let blocked = false;
  for (const line of lines) {
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      const name = ua[1].trim().toLowerCase();
      applies = name === botName.toLowerCase() || name === '*';
      continue;
    }
    if (!applies) continue;
    const dis = line.match(/^disallow:\s*(.*)$/i);
    if (dis && dis[1].trim() === '/') blocked = true;
    const allow = line.match(/^allow:\s*(.*)$/i);
    if (allow && allow[1].trim() === '/') blocked = false;
  }
  return blocked;
};

const AI_BOTS = [
  { bot: 'GPTBot', label: 'GPTBot（ChatGPT学習）' },
  { bot: 'OAI-SearchBot', label: 'OAI-SearchBot（ChatGPT検索）' },
  { bot: 'PerplexityBot', label: 'PerplexityBot' },
  { bot: 'ClaudeBot', label: 'ClaudeBot（Claude）' },
  { bot: 'Google-Extended', label: 'Google-Extended（Gemini学習）' },
];

const extractJsonLd = (html: string): unknown[] => {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      /* invalid json-ld block */
    }
  }
  return out;
};

const jsonLdTypes = (nodes: unknown[]): string[] => {
  const types: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const obj = n as Record<string, unknown>;
    const t = obj['@type'];
    if (typeof t === 'string') types.push(t);
    if (Array.isArray(t)) types.push(...t.map(String));
    if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(walk);
  };
  nodes.forEach(walk);
  return types;
};

export const runAudit = async (project: Project): Promise<AuditResult> => {
  const checks: AuditCheck[] = [];
  const push = (c: AuditCheck) => checks.push(c);

  if (!project.siteUrl) {
    return {
      score: 0,
      checks: [
        {
          key: 'site_url',
          label: 'サイトURL',
          passed: false,
          weight: 1,
          detail: 'サイトURLが未設定のため診断できません。',
          howToFix: 'ダッシュボードのプロジェクト設定でホームページURLを登録してください。',
        },
      ],
      fetchedUrl: null,
    };
  }

  const siteUrl = project.siteUrl.startsWith('http') ? project.siteUrl : `https://${project.siteUrl}`;
  const origin = (() => {
    try {
      return new URL(siteUrl).origin;
    } catch {
      return null;
    }
  })();
  if (!origin) {
    return { score: 0, checks: [], fetchedUrl: null, error: 'URLが不正です' };
  }

  const page = await fetchText(siteUrl);
  if (!page || page.status >= 400) {
    return {
      score: 0,
      checks: [
        {
          key: 'reachable',
          label: 'サイトへの到達性',
          passed: false,
          weight: 3,
          detail: page ? `HTTP ${page.status} が返りました。` : 'サイトに接続できませんでした（タイムアウト/DNS）。',
          howToFix: 'サイトが公開されているか、URLが正しいかを確認してください。',
        },
      ],
      fetchedUrl: siteUrl,
    };
  }

  const html = page.text;
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  push({ key: 'reachable', label: 'サイトへの到達性', passed: true, weight: 3, detail: `HTTP ${page.status} OK` });
  push({
    key: 'https',
    label: 'HTTPS',
    passed: page.finalUrl.startsWith('https://'),
    weight: 2,
    detail: page.finalUrl.startsWith('https://') ? 'HTTPSで配信されています。' : 'HTTPのまま配信されています。',
    howToFix: 'SSL証明書を設定しHTTPSへリダイレクトしてください。',
  });

  // --- robots.txt / AIクローラー ---
  const robots = await fetchText(`${origin}/robots.txt`);
  const robotsTxt = robots && robots.status === 200 ? robots.text : '';
  for (const { bot, label } of AI_BOTS) {
    const blocked = robotsTxt ? isBotBlocked(robotsTxt, bot) : false;
    push({
      key: `robots_${bot.toLowerCase().replace(/-/g, '_')}`,
      label: `AIクローラー許可: ${label}`,
      passed: !blocked,
      weight: 2,
      detail: blocked ? 'robots.txt でブロックされています。AIがサイトを読めません。' : '許可されています。',
      howToFix: blocked ? `robots.txt の「User-agent: ${bot}」の Disallow: / を削除してください。` : undefined,
    });
  }

  // --- sitemap ---
  const hasSitemapInRobots = /sitemap:\s*\S+/i.test(robotsTxt);
  const sitemap = hasSitemapInRobots ? null : await fetchText(`${origin}/sitemap.xml`);
  const sitemapOk = hasSitemapInRobots || Boolean(sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.text));
  push({
    key: 'sitemap',
    label: 'サイトマップ',
    passed: sitemapOk,
    weight: 1,
    detail: sitemapOk ? 'sitemap.xml が確認できました。' : 'sitemap.xml が見つかりません。',
    howToFix: 'sitemap.xml を生成・設置し、robots.txt に Sitemap: 行を追加してください。',
  });

  // --- 構造化データ ---
  const ld = extractJsonLd(html);
  const types = jsonLdTypes(ld);
  const hasLocalBiz = types.some((t) =>
    /LocalBusiness|Organization|Store|Restaurant|BeautySalon|HairSalon|Dentist|MedicalBusiness|ProfessionalService|Corporation/i.test(t),
  );
  const hasFaqLd = types.some((t) => /FAQPage/i.test(t));
  push({
    key: 'jsonld_present',
    label: '構造化データ（JSON-LD）',
    passed: ld.length > 0,
    weight: 3,
    detail: ld.length > 0 ? `JSON-LDを${ld.length}ブロック検出（型: ${[...new Set(types)].slice(0, 5).join(', ') || '不明'}）` : '構造化データがありません。AIがサイト情報を機械的に理解できません。',
    howToFix: '改善タスクの「JSON-LD貼り付けコード」を<head>内に追加してください。',
  });
  push({
    key: 'jsonld_localbusiness',
    label: '事業者情報の構造化（LocalBusiness/Organization）',
    passed: hasLocalBiz,
    weight: 3,
    detail: hasLocalBiz ? '事業者スキーマがあります。' : '事業者情報（名前・住所・営業時間等）のスキーマがありません。',
    howToFix: 'LocalBusiness（業種別サブタイプ推奨）のJSON-LDを追加してください。',
  });
  push({
    key: 'jsonld_faq',
    label: 'FAQの構造化（FAQPage）',
    passed: hasFaqLd,
    weight: 2,
    detail: hasFaqLd ? 'FAQPageスキーマがあります。' : 'FAQPageスキーマがありません。Q&A形式はAIが最も引用しやすい構造です。',
    howToFix: 'FAQページを作り、FAQPageのJSON-LDを付与してください（改善タスクで文案を生成できます）。',
  });

  // --- 基本メタ ---
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  push({
    key: 'title',
    label: 'ページタイトル',
    passed: title.length >= 10 && title.length <= 70,
    weight: 2,
    detail: title ? `「${title.slice(0, 60)}」(${title.length}文字)` : 'titleタグがありません。',
    howToFix: '「サービス内容×地域×事業者名」を含む10〜60文字程度のタイトルにしてください。',
  });
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ?? '';
  push({
    key: 'meta_description',
    label: 'メタディスクリプション',
    passed: metaDesc.length >= 40,
    weight: 1,
    detail: metaDesc ? `${metaDesc.length}文字` : '未設定です。',
    howToFix: 'サービスの要約（結論先出し・80〜120文字）を設定してください。',
  });
  push({
    key: 'h1',
    label: '見出し構造（h1）',
    passed: /<h1[\s>]/i.test(html),
    weight: 1,
    detail: /<h1[\s>]/i.test(html) ? 'h1があります。' : 'h1見出しがありません。',
    howToFix: 'ページの主題を表すh1を1つ設置してください。',
  });
  push({
    key: 'og',
    label: 'OGP（シェア用メタ）',
    passed: /property=["']og:title["']/i.test(html),
    weight: 1,
    detail: /property=["']og:title["']/i.test(html) ? 'OGPがあります。' : 'OGPがありません。',
    howToFix: 'og:title / og:description / og:image を設定してください。',
  });
  push({
    key: 'viewport',
    label: 'モバイル対応（viewport）',
    passed: /name=["']viewport["']/i.test(html),
    weight: 1,
    detail: /name=["']viewport["']/i.test(html) ? 'viewport設定があります。' : 'viewportがなくモバイル非対応の可能性。',
    howToFix: '<meta name="viewport" content="width=device-width, initial-scale=1"> を追加してください。',
  });

  // --- コンテンツシグナル ---
  const hasFaqContent = /よくある質問|FAQ|Q&A|Ｑ＆Ａ/i.test(textOnly);
  push({
    key: 'faq_content',
    label: 'FAQコンテンツ',
    passed: hasFaqContent,
    weight: 2,
    detail: hasFaqContent ? 'FAQらしいコンテンツがあります。' : 'FAQコンテンツが見つかりません。',
    howToFix: '見込み客の質問に答えるFAQセクション/ページを追加してください（改善タスクで文案を生成できます）。',
  });
  const hasDate = /<time[\s>]|更新日|最終更新|datePublished|dateModified/i.test(html);
  push({
    key: 'freshness',
    label: '更新日の明示',
    passed: hasDate,
    weight: 1,
    detail: hasDate ? '日付シグナルがあります。' : '更新日・公開日の表記が見つかりません。AIは新しい情報を優先します。',
    howToFix: 'ページに更新日を表示し、構造化データに dateModified を含めてください。',
  });
  const hasPhone = /tel:|0\d{1,4}[-(]\d{1,4}[-)]\d{3,4}/.test(html);
  push({
    key: 'nap_phone',
    label: '電話番号の掲載',
    passed: hasPhone,
    weight: 1,
    detail: hasPhone ? '電話番号があります。' : '電話番号が見つかりません（NAP情報はローカルAI回答の重要シグナル）。',
    howToFix: 'フッター等に電話番号をテキストで掲載してください。',
  });
  const hasAddress = /(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)[都道府県]?[市区町村]/.test(textOnly);
  push({
    key: 'nap_address',
    label: '住所の掲載',
    passed: hasAddress,
    weight: 1,
    detail: hasAddress ? '住所らしい表記があります。' : '住所が見つかりません。',
    howToFix: '店舗/事務所の住所をテキストで掲載してください。',
  });

  const applicable = checks.filter((c) => c.passed !== null);
  const earned = applicable.filter((c) => c.passed).reduce((a, c) => a + c.weight, 0);
  const total = applicable.reduce((a, c) => a + c.weight, 0);
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;

  return { score, checks, fetchedUrl: page.finalUrl };
};
