import { getSession } from '@/lib/session-server';
import { getProjectByPaletteId, getLatestAudit, getAuditHistory } from '@/lib/db';
import type { AuditCheck } from '@/lib/audit';
import Onboarding from '../Onboarding';
import AuditView from './AuditView';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const session = await getSession();
  if (!session) return null;

  const project = await getProjectByPaletteId(session.paletteId);
  if (!project) return <Onboarding />;

  const [audit, history] = await Promise.all([getLatestAudit(project.id), getAuditHistory(project.id)]);

  return (
    <AuditView
      siteUrl={project.siteUrl}
      initialAudit={
        audit
          ? { score: audit.score, checks: audit.checks as AuditCheck[], runAt: audit.runAt, fetchedUrl: audit.fetchedUrl }
          : null
      }
      history={history}
    />
  );
}
