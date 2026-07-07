import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listActions } from '@/lib/db';
import Onboarding from '../Onboarding';
import ActionList from './ActionList';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const actions = await listActions(project.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black">改善タスク</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          診断結果と「AIに言及されなかった質問」から、スコアを上げるための施策を成果物付きで自動生成します。
          実装したら「実装済み」にすると、次回以降の計測で効果を確認できます。
        </p>
      </div>
      <ActionList initialActions={actions} />
    </div>
  );
}
