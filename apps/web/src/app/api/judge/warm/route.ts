import { apiContext, fail, json } from '@/lib/api';
import { warmJudge } from '@/lib/judge';
import { sameOrigin } from '@/lib/submissions';

/** Opening a problem wakes the judge box, so the first Run skips most of the cold start. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, 'Cross-origin request');
  const { env, ctx, viewer } = await apiContext();
  if (!viewer) return json({ ok: false });
  ctx.waitUntil(warmJudge(env));
  return json({ ok: true });
}
