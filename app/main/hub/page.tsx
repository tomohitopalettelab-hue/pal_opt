import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getHubData, listHubFaqSuggestions } from '@/lib/db';
import Onboarding from '../Onboarding';
import HubClient from './HubClient';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const [hubData, suggestions] = await Promise.all([
    getHubData(project.id),
    listHubFaqSuggestions(project.id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-black">AIOハブページ</h1>
        <p className="text-xs font-bold opacity-50 mt-1">
          既存ホームページはそのままに、AIが読み取りやすい「FAQ＋事業者情報」の1枚ページを当社ドメインで公開します。
          既存HPからテキストリンクを貼るだけで、AI検索に引用される受け皿になります。
        </p>
      </div>
      <HubClient
        project={{
          businessName: project.businessName,
          siteUrl: project.siteUrl,
          hubEnabled: project.hubEnabled,
          hubUrl: project.hubUrl,
        }}
        initialData={hubData}
        initialSuggestions={suggestions}
      />
    </div>
  );
}
