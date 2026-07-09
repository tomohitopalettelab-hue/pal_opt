/**
 * AIOハブページの自動入力。
 * 情報ソースは2系統（両方あれば併用・どちらかだけでも動く）:
 *   a. 既存HP: project.siteUrl の本文テキスト
 *   b. GBP: Business Information API v1 のロケーション詳細
 *
 * ルール:
 * - NAP（住所・電話・営業時間・郵便番号）は GBP の値を最優先（権威ソース）。
 *   GBPに無い項目のみHPからのLLM抽出で補完。どちらにも無ければ空のまま（捏造・プレースホルダ禁止）
 * - 説明文は結論先出し2〜3文（提供サービスがソースにあれば具体的に織り込む）
 */
import OpenAI from 'openai';
import type { HubData, Project } from './db';
import { getProjectGoogleToken } from './db';
import { fetchSiteText } from './suggest-prompts';
import { refreshAccessToken, getGbpLocationDetails, type GbpLocationDetails } from './google';

const AUTOFILL_MODEL = process.env.ACTIONS_MODEL || 'gpt-4o';

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

export type HubAutofillSources = { site: boolean; gbp: boolean };

export type HubAutofillResult = {
  /** 取得できたフィールドのみ値が入る（空文字=取得できず） */
  fields: Pick<HubData, 'description' | 'postalCode' | 'address' | 'tel' | 'businessHours'>;
  sources: HubAutofillSources;
};

/** GBPロケーション詳細を取得（未連携・失敗時は null で続行） */
const fetchGbpDetails = async (project: Project): Promise<GbpLocationDetails | null> => {
  if (!project.googleConnected || !project.gbpLocation) return null;
  try {
    const refreshToken = await getProjectGoogleToken(project.id);
    if (!refreshToken) return null;
    const token = await refreshAccessToken(refreshToken);
    return await getGbpLocationDetails(token, project.gbpLocation);
  } catch {
    return null;
  }
};

/** HP本文からのLLM抽出＋説明文生成 */
const generateWithLlm = async (
  project: Project,
  siteText: string,
  gbp: GbpLocationDetails | null,
): Promise<Partial<HubAutofillResult['fields']>> => {
  const gbpSummary = gbp
    ? [
        gbp.categories.length ? `カテゴリ: ${gbp.categories.join(' / ')}` : '',
        gbp.profileDescription ? `GBPの説明文: ${gbp.profileDescription.slice(0, 800)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const res = await openai().chat.completions.create({
    model: AUTOFILL_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたは事業者情報の抽出・整理の専門家です。以下のソースから、事業者のFAQ/案内ページに載せる情報を抽出してください。

事業者: ${project.businessName}（${[project.industry, project.area].filter(Boolean).join(' / ')}）

ルール（最重要・厳守）:
- ソースに書かれている事実だけを使う。**推測・捏造・プレースホルダ（「◯◯」等）は絶対に入れない**
- ソースに無い項目は空文字 "" にする
- description: 結論先出しで2〜3文。何をしている事業者か→主なサービス・強み（ソースにある具体的なメニュー・サービス名を織り込む）→どんな人向けか
- postalCode: 「150-0001」形式。ハイフン無しで書かれていたらハイフン付きに正規化してよい（数字自体は変えない）
- address: 都道府県から始まる1行（建物名まで書かれていればそのまま含める）
- tel: ソース記載の表記のまま（例 03-1234-5678）
- businessHours: 営業時間・定休日を読みやすい1行に（例「10:00〜19:00（水曜定休）」）
- 出力はJSON: {"description": "...", "postalCode": "...", "address": "...", "tel": "...", "businessHours": "..."}`,
      },
      {
        role: 'user',
        content: `${gbpSummary ? `【ソース1: Googleビジネスプロフィール】\n${gbpSummary}\n\n` : ''}${
          siteText ? `【ソース${gbpSummary ? '2' : '1'}: 既存ホームページ本文】\n${siteText}` : ''
        }${!gbpSummary && !siteText ? '（ソースなし）' : ''}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
    return {
      description: String(parsed.description ?? '').trim(),
      postalCode: String(parsed.postalCode ?? '').trim(),
      address: String(parsed.address ?? '').trim(),
      tel: String(parsed.tel ?? '').trim(),
      businessHours: String(parsed.businessHours ?? '').trim(),
    };
  } catch {
    return {};
  }
};

/**
 * HP・GBPからハブの事業者情報を自動構成。
 * NAPはGBPの値で最終上書き（権威ソース優先）。取得できなかった項目は空のまま。
 */
export const autofillHubFields = async (project: Project): Promise<HubAutofillResult> => {
  const [siteText, gbp] = await Promise.all([
    project.siteUrl ? fetchSiteText(project.siteUrl).catch(() => '') : Promise.resolve(''),
    fetchGbpDetails(project),
  ]);

  const sources: HubAutofillSources = { site: Boolean(siteText), gbp: Boolean(gbp) };

  let llm: Partial<HubAutofillResult['fields']> = {};
  if (siteText || gbp) {
    llm = await generateWithLlm(project, siteText, gbp).catch(() => ({}));
  }

  // NAPはGBPを最優先で確定上書き（LLMの揺れ・捏造を排除）。説明はLLM優先、無ければGBPの説明文
  const fields: HubAutofillResult['fields'] = {
    description: llm.description || gbp?.profileDescription?.slice(0, 300) || '',
    postalCode: gbp?.postalCode || llm.postalCode || '',
    address: gbp?.address || llm.address || '',
    tel: gbp?.phone || llm.tel || '',
    businessHours: gbp?.businessHours || llm.businessHours || '',
  };

  return { fields, sources };
};
