import { and, eq, sql } from 'drizzle-orm';
import {
  problem,
  problemContent,
  submission,
  testSet,
  userProblem,
  LANGUAGES,
  type Db,
  type Example,
} from '@kingcoda/db';
import {
  buildJob,
  interpret,
  isJudged,
  parseCustomInput,
  type BoxJob,
  type BoxResult,
  type JudgeCase,
  type Verdict,
} from '@kingcoda/judge-core';
import { canonical, type Checker, type Signature } from '@kingcoda/problem-schema';

/** What the web Worker stores in R2 for each submission. */
export interface StoredCode {
  code: string;
  /** Run only: the custom input box, one JSON value per line per parameter. */
  customInput?: string;
}

export interface JudgeDeps {
  db: Db;
  code: R2Bucket;
  tests: R2Bucket;
  runBox(job: BoxJob): Promise<BoxResult>;
  now?: () => Date;
}

/** Thrown for failures worth a queue retry (box unavailable, R2 hiccup). */
export class Retryable extends Error {}

const hiddenCache = new Map<string, JudgeCase[]>();

async function loadJsonl(bucket: R2Bucket, key: string): Promise<JudgeCase[]> {
  const cached = hiddenCache.get(key);
  if (cached) return cached;
  const obj = await bucket.get(key);
  if (!obj) throw new Error(`test set missing from R2: ${key}`);
  const cases = (await obj.text())
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as JudgeCase);
  // A few problems' suites (a few MB each) stay warm in the isolate between submissions.
  if (hiddenCache.size >= 4) hiddenCache.delete(hiddenCache.keys().next().value!);
  hiddenCache.set(key, cases);
  return cases;
}

function exampleCases(sig: Signature, examples: Example[]): JudgeCase[] {
  return examples.map((e) => ({
    args: sig.params.map((p) => e.input[p.name]),
    expected: e.output,
  }));
}

/**
 * Custom input's expected outputs: from an example with the same input when there is one,
 * otherwise from the reference solution run in a separate job.
 */
async function expectedForCustom(
  deps: JudgeDeps,
  id: string,
  sig: Signature,
  limits: { timeMs: number; memoryMb: number },
  examples: JudgeCase[],
  reference: string | undefined,
  inputs: unknown[][],
): Promise<JudgeCase[]> {
  const byArgs = new Map(examples.map((e) => [canonical(e.args), e.expected]));
  const cases: JudgeCase[] = inputs.map((args) => {
    const key = canonical(args);
    return byArgs.has(key) ? { args, expected: byArgs.get(key) } : { args };
  });
  const unknown = cases.filter((c) => !('expected' in c));
  if (unknown.length === 0 || !reference) return cases;

  const plan = buildJob({
    id: `${id}-ref`,
    signature: sig,
    lang: 'cpp',
    code: reference,
    cases: unknown,
    publicCount: unknown.length,
    limits: { timeMs: limits.timeMs * 2, memoryMb: limits.memoryMb },
    mode: 'run',
  });
  const ref = interpret(plan, await deps.runBox(plan.job), unknown, { checker: { kind: 'exact' } });
  if (ref.verdict === 'IE') throw new Retryable('reference run failed in the box');
  for (const [i, c] of unknown.entries()) {
    const r = ref.cases?.[i];
    // The reference failing means the input breaks the constraints; the case shows no expected output.
    if (r && r.verdict === 'AC') c.expected = r.actual;
  }
  return cases;
}

function langBit(lang: string): number {
  const i = (LANGUAGES as readonly string[]).indexOf(lang);
  return i < 0 ? 0 : 1 << i;
}

export type JudgeOutcome = 'judged' | 'skipped';

/** Judges one submission end to end and writes the verdict. Safe to call again for the same id. */
export async function judgeSubmission(deps: JudgeDeps, id: string): Promise<JudgeOutcome> {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());
  const sub = await db.query.submission.findFirst({ where: eq(submission.id, id) });
  if (!sub || sub.status === 'done' || sub.status === 'error') return 'skipped';

  await db.update(submission).set({ status: 'running' }).where(eq(submission.id, id));

  const content = await db.query.problemContent.findFirst({
    where: and(
      eq(problemContent.problemId, sub.problemId),
      eq(problemContent.version, sub.problemVersion),
    ),
  });
  if (!content) return fail(deps, id, 'Problem content is missing');

  const sig = content.signature as unknown as Signature;
  const checker = content.checker as unknown as Checker;
  const limits = content.limits;
  const examples = exampleCases(sig, content.examples);

  const stored = await deps.code.get(sub.codeR2Key);
  if (!stored) return fail(deps, id, 'Submitted code is missing');
  const { code, customInput } = JSON.parse(await stored.text()) as StoredCode;

  if (!isJudged(sub.lang)) return fail(deps, id, `${sub.lang} is not judged yet`);

  let cases: JudgeCase[];
  let publicCount: number;
  if (sub.mode === 'run') {
    if (customInput === undefined) {
      cases = examples;
    } else {
      const parsed = parseCustomInput(sig, customInput);
      if (!parsed.ok) return fail(deps, id, parsed.error);
      cases = await expectedForCustom(
        deps,
        id,
        sig,
        limits,
        examples,
        content.referenceSolutions.cpp,
        parsed.cases,
      );
    }
    publicCount = cases.length;
  } else {
    const set = await db.query.testSet.findFirst({
      where: and(
        eq(testSet.problemId, sub.problemId),
        eq(testSet.version, sub.problemVersion),
        eq(testSet.kind, 'hidden'),
      ),
    });
    if (!set) return fail(deps, id, 'Hidden tests are missing');
    cases = [...examples, ...(await loadJsonl(deps.tests, set.r2Key))];
    publicCount = examples.length;
  }

  const plan = buildJob({
    id,
    signature: sig,
    lang: sub.lang,
    code,
    cases,
    publicCount,
    limits,
    mode: sub.mode === 'run' ? 'run' : 'submit',
  });
  const verdict = interpret(plan, await deps.runBox(plan.job), cases, { checker });
  if (verdict.verdict === 'IE') throw new Retryable(verdict.failure?.message ?? 'internal error');

  await record(deps, sub, verdict, now());
  return 'judged';
}

type SubmissionRow = typeof submission.$inferSelect;

async function record(deps: JudgeDeps, sub: SubmissionRow, v: Verdict, at: Date) {
  const { db } = deps;
  const { compileOutput, ...report } = v;
  const done = db
    .update(submission)
    .set({
      status: 'done',
      verdict: v.verdict,
      passed: v.passed,
      total: v.total,
      runtimeMs: v.verdict === 'AC' ? v.runtimeMs : null,
      memoryKb: v.verdict === 'AC' ? v.memoryKb : null,
      report: report as Record<string, unknown>,
      compileLog: compileOutput ?? null,
      judgedAt: at,
    })
    .where(eq(submission.id, sub.id));

  // Runs don't count toward progress or acceptance.
  if (sub.mode === 'run') {
    await done;
    return;
  }

  const accepted = v.verdict === 'AC';
  const prev = await db.query.userProblem.findFirst({
    where: and(eq(userProblem.userId, sub.userId), eq(userProblem.problemId, sub.problemId)),
  });
  const best = (a: number | null | undefined, b: number) => (a == null ? b : Math.min(a, b));
  const progress = {
    status: prev?.status === 'solved' || accepted ? ('solved' as const) : ('attempted' as const),
    attempts: (prev?.attempts ?? 0) + 1,
    wrongStreak: accepted ? 0 : (prev?.wrongStreak ?? 0) + 1,
    firstAcceptedAt: prev?.firstAcceptedAt ?? (accepted ? at : null),
    firstTry: prev ? prev.firstTry : accepted,
    bestRuntimeMs: accepted
      ? best(prev?.bestRuntimeMs, v.runtimeMs)
      : (prev?.bestRuntimeMs ?? null),
    bestMemoryKb: accepted ? best(prev?.bestMemoryKb, v.memoryKb) : (prev?.bestMemoryKb ?? null),
    langsSolved: (prev?.langsSolved ?? 0) | (accepted ? langBit(sub.lang) : 0),
    updatedAt: at,
  };

  await db.batch([
    done,
    db
      .insert(userProblem)
      .values({ userId: sub.userId, problemId: sub.problemId, ...progress })
      .onConflictDoUpdate({ target: [userProblem.userId, userProblem.problemId], set: progress }),
    db
      .update(problem)
      .set({
        submissionCount: sql`${problem.submissionCount} + 1`,
        acceptedCount: sql`${problem.acceptedCount} + ${accepted ? 1 : 0}`,
        acceptanceRate: sql`(${problem.acceptedCount} + ${accepted ? 1 : 0}) * 1.0 / (${problem.submissionCount} + 1)`,
      })
      .where(eq(problem.id, sub.problemId)),
  ]);
}

/** A failure that retrying won't fix: the submission ends as an internal error. */
async function fail(deps: JudgeDeps, id: string, message: string): Promise<JudgeOutcome> {
  await markError(deps.db, id, message, (deps.now ?? (() => new Date()))());
  return 'judged';
}

export async function markError(db: Db, id: string, message: string, at = new Date()) {
  await db
    .update(submission)
    .set({
      status: 'error',
      verdict: 'IE',
      report: { verdict: 'IE', failure: { index: 0, message } },
      judgedAt: at,
    })
    .where(eq(submission.id, id));
}
