import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { draft, problem } from '@kingcoda/db';
import { isJudged } from '@kingcoda/judge-core';
import { apiContext, fail, json } from '@/lib/api';
import { MAX_CODE_BYTES, sameOrigin } from '@/lib/submissions';

const body = z
  .object({
    slug: z.string().min(1).max(80),
    lang: z.string().refine(isJudged),
    code: z.string().max(MAX_CODE_BYTES),
  })
  .strict();

/** Autosave: the editor's code per problem and language. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail(403, 'Cross-origin request');
  const { db, viewer } = await apiContext();
  if (!viewer) return fail(401, 'Sign in to save drafts');
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, 'Bad draft');
  const { slug, code } = parsed.data;
  const p = await db.query.problem.findFirst({
    columns: { id: true },
    where: eq(problem.slug, slug),
  });
  if (!p) return fail(404, 'No such problem');
  const now = new Date();
  await db
    .insert(draft)
    .values({ userId: viewer.user.id, problemId: p.id, lang: 'cpp', code, updatedAt: now })
    .onConflictDoUpdate({
      target: [draft.userId, draft.problemId, draft.lang],
      set: { code, updatedAt: now },
    });
  return json({ savedAt: now.getTime() });
}

/** Back to starter code: forget the draft. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail(403, 'Cross-origin request');
  const { db, viewer } = await apiContext();
  if (!viewer) return fail(401, 'Sign in to save drafts');
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const p = await db.query.problem.findFirst({
    columns: { id: true },
    where: eq(problem.slug, slug),
  });
  if (!p) return fail(404, 'No such problem');
  await db
    .delete(draft)
    .where(and(eq(draft.userId, viewer.user.id), eq(draft.problemId, p.id), eq(draft.lang, 'cpp')));
  return json({ ok: true });
}
