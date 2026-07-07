/**
 * GBP書き込み系（意図的にこのファイルへ隔離）。
 * Reviews/Local PostsはGoogleのAPI刷新でv4に残された領域のため、
 * 将来の仕様変更・廃止時はこのファイルだけ差し替えれば済む構造にしておく。
 * 運用ルール: 送信は必ず「人間の承認（UIのボタン操作）」を経由すること。全自動送信は実装しない。
 */
import OpenAI from 'openai';
import type { Project } from './db';

const REPLY_MODEL = process.env.ACTIONS_MODEL || 'gpt-4o';
const MAX_REPLY_LENGTH = 4000; // GBP上限4096より安全側

let _openai: OpenAI | null = null;
const openai = (): OpenAI => {
  if (!_openai) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY_API is not configured');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
};

export type ReviewForReply = {
  reviewer: string;
  starRating: number;
  comment: string;
};

/** 口コミ返信の下書きを生成（送信はしない） */
export const generateReplyDraft = async (
  project: Project,
  review: ReviewForReply,
  style: '丁寧' | 'フレンドリー' = '丁寧',
): Promise<string> => {
  const res = await openai().chat.completions.create({
    model: REPLY_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたは「${project.businessName}」（${[project.industry, project.area].filter(Boolean).join(' / ')}）のオーナーとして、Googleビジネスプロフィールの口コミに返信します。

ルール:
- トーン: ${style}。日本語で2〜4文、150〜300文字程度
- まず来店/利用への感謝。口コミの具体的な内容に必ず1箇所は触れる（テンプレ感を出さない）
- 低評価(星1〜3)の場合: 言い訳をせず真摯に受け止め、改善の意思を伝える。事実関係への反論・顧客批判は絶対にしない
- 約束できない具体的な補償・割引は書かない。個人情報・来店詳細の暴露をしない
- 絵文字は使わない。誇大表現をしない
- 返信文のみを出力（前置き・引用符なし）`,
      },
      {
        role: 'user',
        content: `【口コミ】星${review.starRating} / 投稿者: ${review.reviewer}\n${review.comment || '（コメントなし・評価のみ）'}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  const draft = (res.choices?.[0]?.message?.content ?? '').trim();
  if (!draft) throw new Error('返信案の生成に失敗しました。');
  return draft.slice(0, MAX_REPLY_LENGTH);
};

/**
 * 口コミへ返信を送信（v4 reviews.updateReply）。
 * locationName: accounts/{a}/locations/{l} 形式、reviewId: 口コミID。
 */
export const sendReviewReply = async (
  accessToken: string,
  locationName: string,
  reviewId: string,
  comment: string,
): Promise<void> => {
  const body = comment.trim().slice(0, MAX_REPLY_LENGTH);
  if (!body) throw new Error('返信内容が空です。');
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: body }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `返信の送信に失敗しました (${res.status})`);
  }
};
