import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, listPrompts } from '@/lib/db';
import Onboarding from '../Onboarding';
import PromptList from './PromptList';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const prompts = await listPrompts(project.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black">観測プロンプト</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          お客さんがAIに聞きそうな質問を毎日各エンジンに投げて、回答の中の言及を記録します。
          不要な質問はOFFにできます。
        </p>
      </div>
      <PromptList initialPrompts={prompts} />
    </div>
  );
}
