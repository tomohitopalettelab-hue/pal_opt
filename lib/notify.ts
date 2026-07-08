/**
 * 成果通知の検知・生成（アプリ内通知）。
 * cron収集の後に呼び、本日の計測結果から「初言及」「競合の新出現」「自社サイト初引用」を検知して
 * pal_opt_notifications に挿入する。重複防止は同プロジェクト×同typeでJST同日1件。
 * type を持たせているので、将来メール/LINE配信に拡張可能。
 */
import {
  detectFirstMentionsToday,
  detectNewCompetitorsToday,
  detectFirstCitationsToday,
  insertNotificationOncePerDay,
} from './db';
import { ENGINE_LABELS, type Engine } from './engines';

const engineLabel = (engine: string): string => ENGINE_LABELS[engine as Engine] ?? engine;

/** 成果イベントを検知して通知を作成。作成した通知件数を返す。 */
export const detectAndNotify = async (): Promise<number> => {
  let created = 0;

  // (a) 初言及
  const firstMentions = await detectFirstMentionsToday();
  const mentionsByProject = new Map<number, Array<{ promptText: string; engine: string }>>();
  for (const m of firstMentions) {
    const list = mentionsByProject.get(m.projectId) ?? [];
    list.push(m);
    mentionsByProject.set(m.projectId, list);
  }
  for (const [projectId, items] of mentionsByProject) {
    const lines = items
      .slice(0, 3)
      .map((i) => `「${i.promptText}」（${engineLabel(i.engine)}）`)
      .join('、');
    const more = items.length > 3 ? ` ほか${items.length - 3}件` : '';
    const ok = await insertNotificationOncePerDay(
      projectId,
      'first_mention',
      'AIがあなたを初めて紹介しました',
      `${lines}${more} で初めて言及されました。施策の効果が出はじめています。`,
    );
    if (ok) created += 1;
  }

  // (b) 競合の新出現
  const newComps = await detectNewCompetitorsToday();
  const compsByProject = new Map<number, string[]>();
  for (const c of newComps) {
    const list = compsByProject.get(c.projectId) ?? [];
    list.push(c.name);
    compsByProject.set(c.projectId, list);
  }
  for (const [projectId, names] of compsByProject) {
    const shown = names.slice(0, 5).join('、');
    const more = names.length > 5 ? ` ほか${names.length - 5}件` : '';
    const ok = await insertNotificationOncePerDay(
      projectId,
      'new_competitor',
      'AIの回答に新しい競合が登場しました',
      `${shown}${more} が直近14日で初めてAIの回答に登場しました。動向をチェックしましょう。`,
    );
    if (ok) created += 1;
  }

  // (c) 自社サイト初引用
  const firstCitations = await detectFirstCitationsToday();
  for (const projectId of firstCitations) {
    const ok = await insertNotificationOncePerDay(
      projectId,
      'first_citation',
      '自社サイトが初めて引用されました',
      'AIの回答であなたのサイトが情報源として初めて引用されました。AIO施策の大きな成果です。',
    );
    if (ok) created += 1;
  }

  return created;
};
