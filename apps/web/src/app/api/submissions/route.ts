import { and, desc, eq } from 'drizzle-orm';
import { newId, problem, problemContent, submission } from '@kingcoda/db';
import type { Signature } from '@kingcoda/problem-schema';
import { apiContext, fail, json } from '@/lib/api';
import { queueSubmission } from '@/lib/judge';
import { checkSubmission, codeKey, sameOrigin, sha256 } from '@/lib/submissions';

/** Run or Submit. Returns the submission id to poll. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, 'Cross-origin request');
  const { env, db, viewer } = await apiContext();
  if (!viewer) return fail(401, 'Sign in to run code');

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, 'Expected a JSON body');
  }
  const first = checkSubmission(raw);
  if (!first.ok) return fail(400, first.error);
  const { slug, mode, code, customInput } = first.body;

  const limiter = mode === 'submit' ? env.SUBMIT_LIMIT : env.RUN_LIMIT;
  const { success } = await limiter.limit({ key: viewer.user.id });
  if (!success)
    return fail(
      429,
      mode === 'submit'
        ? 'Up to 6 submissions a minute. Take a breath.'
        : 'Up to 20 runs a minute.',
      { 'retry-after': '60' },
    );

  const p = await db.query.problem.findFirst({
    where: and(eq(problem.slug, slug), eq(problem.status, 'published')),
  });
  if (!p) return fail(404, 'No such problem');
  const content = await db.query.problemContent.findFirst({
    columns: { signature: true },
    where: and(eq(problemContent.problemId, p.id), eq(problemContent.version, p.version)),
  });
  if (!content) return fail(404, 'No such problem');
  const checked = checkSubmission(raw, content.signature as unknown as Signature);
  if (!checked.ok) return fail(400, checked.error);

  const id = newId();
  const now = new Date();
  const key = codeKey(id, now);
  await env.CODE.put(
    key,
    JSON.stringify({ code, ...(customInput !== undefined ? { customInput } : {}) }),
    {
      httpMetadata: { contentType: 'application/json' },
    },
  );
  await db.insert(submission).values({
    id,
    userId: viewer.user.id,
    problemId: p.id,
    problemVersion: p.version,
    lang: 'cpp',
    mode,
    codeR2Key: key,
    codeHash: await sha256(code),
    codeBytes: new TextEncoder().encode(code).length,
    createdAt: now,
  });
  try {
    await queueSubmission(env, id);
  } catch (e) {
    console.error('judge unavailable', e);
    await db
      .update(submission)
      .set({
        status: 'error',
        verdict: 'IE',
        report: {
          verdict: 'IE',
          failure: { index: 0, message: 'The judge is unavailable right now.' },
        },
      })
      .where(eq(submission.id, id));
    return fail(503, 'The judge is unavailable right now. Try again in a minute.');
  }
  return json({ id }, 202);
}

/** The viewer's recent submissions for one problem (the Submissions tab). */
export async function GET(request: Request) {
  const { db, viewer } = await apiContext();
  if (!viewer) return fail(401, 'Sign in to see your submissions');
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const p = await db.query.problem.findFirst({
    columns: { id: true },
    where: eq(problem.slug, slug),
  });
  if (!p) return fail(404, 'No such problem');
  const rows = await db
    .select({
      id: submission.id,
      verdict: submission.verdict,
      status: submission.status,
      passed: submission.passed,
      total: submission.total,
      runtimeMs: submission.runtimeMs,
      memoryKb: submission.memoryKb,
      lang: submission.lang,
      createdAt: submission.createdAt,
    })
    .from(submission)
    .where(
      and(
        eq(submission.userId, viewer.user.id),
        eq(submission.problemId, p.id),
        eq(submission.mode, 'submit'),
      ),
    )
    .orderBy(desc(submission.createdAt))
    .limit(20);
  return json({ submissions: rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })) });
}
