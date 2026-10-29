import { and, eq } from 'drizzle-orm';
import { submission } from '@kingcoda/db';
import { apiContext, fail, json } from '@/lib/api';
import type { SubmissionView } from '@/lib/submissions';

/** Poll a submission. Only its owner can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, viewer } = await apiContext();
  if (!viewer) return fail(401, 'Sign in to see your submissions');
  const s = await db.query.submission.findFirst({
    where: and(eq(submission.id, id), eq(submission.userId, viewer.user.id)),
  });
  if (!s) return fail(404, 'No such submission');
  const view: SubmissionView = {
    id: s.id,
    mode: s.mode === 'run' ? 'run' : 'submit',
    status: s.status,
    verdict: s.verdict,
    passed: s.passed,
    total: s.total,
    runtimeMs: s.runtimeMs,
    memoryKb: s.memoryKb,
    report: s.report ?? null,
    compileLog: s.compileLog,
    createdAt: s.createdAt.getTime(),
  };
  return json(view);
}
