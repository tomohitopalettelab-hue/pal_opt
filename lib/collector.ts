/**
 * 計測バッチ: 実行対象プロンプトを小バッチで取り出し、
 * 各エンジンで実行→解析→保存する。cronから複数回呼ばれる前提。
 */
import { listDuePrompts, countDuePrompts, markPromptRun, insertRun } from './db';
import { ENGINES, runEngine } from './engines';
import { analyzeAnswer } from './analyze';

export type CollectResult = {
  processed: number;
  runs: number;
  errors: number;
  remaining: number;
};

export const collectBatch = async (batchSize = 4): Promise<CollectResult> => {
  const due = await listDuePrompts(batchSize);
  let runs = 0;
  let errors = 0;

  for (const prompt of due) {
    // 二重実行防止のため先にマーク（失敗しても翌日リトライされる）
    await markPromptRun(prompt.id);

    for (const engine of ENGINES) {
      try {
        const result = await runEngine(engine, prompt.text);
        const analysis = await analyzeAnswer(prompt.project, result.answerText, result.citations);
        await insertRun({
          projectId: prompt.projectId,
          promptId: prompt.id,
          engine,
          answerText: result.answerText,
          mentioned: analysis.mentioned,
          mentionPosition: analysis.mentionPosition,
          sentiment: analysis.sentiment,
          competitorsMentioned: analysis.competitorsMentioned,
          cited: analysis.cited,
          citations: result.citations,
        });
        runs += 1;
      } catch (e) {
        errors += 1;
        await insertRun({
          projectId: prompt.projectId,
          promptId: prompt.id,
          engine,
          answerText: '',
          mentioned: false,
          mentionPosition: null,
          sentiment: null,
          competitorsMentioned: [],
          cited: false,
          citations: [],
          error: e instanceof Error ? e.message.slice(0, 500) : 'unknown error',
        }).catch(() => {});
      }
    }
  }

  const remaining = await countDuePrompts();
  return { processed: due.length, runs, errors, remaining };
};
