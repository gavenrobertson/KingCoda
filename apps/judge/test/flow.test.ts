import { readdirSync, readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getDb,
  newId,
  problem,
  problemContent,
  submission,
  testSet,
  user,
  userProblem,
  type Db,
} from '@kingcoda/db';
import { LARGEST_CATEGORY, type BoxJob } from '@kingcoda/judge-core';
import { haveGpp, runLocalBox } from '../../../packages/judge-core/test/local-box.ts';
import { judgeSubmission, type JudgeDeps, type StoredCode } from '../src/flow.ts';

interface TestEnv {
  DB: D1Database;
  CODE: R2Bucket;
  TESTS: R2Bucket;
}

const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);
const PROBLEM = 'prb_0099';
const USER = 'usr_test';

const big = Array.from({ length: 50_000 }, (_, i) => i - 25_000);
const hidden = [
  { args: [[]], expected: 0, category: 'empty' },
  { args: [[2147483647, 2147483647]], expected: 4294967294, category: 'overflow' },
  { args: [big], expected: big.reduce((a, b) => a + b, 0), category: LARGEST_CATEGORY },
];
const solution = (body: string) =>
  `class Solution {\npublic:\n    long long sumAll(vector<int>& xs) {\n        ${body}\n    }\n};\n`;
const CORRECT = solution('long long s = 0; for (int x : xs) s += x; return s;');
const OVERFLOWS = solution('int s = 0; for (int x : xs) s += x; return s;');

let proxy: Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;
let db: Db;
let deps: JudgeDeps;
const boxJobs: BoxJob[] = [];

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: 'test/wrangler.test.jsonc',
    persist: false,
  });
  const env = proxy.env;
  for (const f of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const stmts = readFileSync(new URL(f, MIGRATIONS), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);
    await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
  }
  db = getDb(env.DB);
  deps = {
    db,
    code: env.CODE,
    tests: env.TESTS,
    runBox: async (job) => {
      boxJobs.push(job);
      return runLocalBox(job);
    },
  };

  await db.insert(user).values({ id: USER, name: 'Tester', email: 't@example.com' });
  await db.insert(problem).values({
    id: PROBLEM,
    number: 99,
    slug: 'sum-all',
    title: 'Sum All',
    difficulty: 'Easy',
    difficultyDisplay: 'Easy',
    tags: ['Arrays'],
    status: 'published',
    license: 'CC-BY-SA-4.0',
  });
  await db.insert(problemContent).values({
    problemId: PROBLEM,
    version: 1,
    statementMd: 'Sum them.',
    constraintsMd: '- small',
    examples: [{ input: { xs: [1, 2, 3] }, output: 6 }],
    hints: [],
    signature: { function: 'sumAll', params: [{ name: 'xs', type: 'int[]' }], returns: 'long' },
    starterCode: {},
    limits: { timeMs: 1000, memoryMb: 256 },
    checker: { kind: 'exact' },
    editorialMd: '',
    referenceSolutions: { cpp: CORRECT },
  });
  await db.insert(testSet).values({
    problemId: PROBLEM,
    version: 1,
    kind: 'hidden',
    r2Key: 'tests/sum-all/v1/hidden.jsonl',
    count: hidden.length,
    checksum: 'x',
  });
  await env.TESTS.put(
    'tests/sum-all/v1/hidden.jsonl',
    hidden.map((c) => JSON.stringify(c)).join('\n') + '\n',
  );
});

afterAll(async () => {
  await proxy?.dispose();
});

async function make(mode: 'run' | 'submit', stored: StoredCode, problemId = PROBLEM) {
  const id = newId();
  const key = `subm/test/${id}`;
  await proxy.env.CODE.put(key, JSON.stringify(stored));
  await db.insert(submission).values({
    id,
    userId: USER,
    problemId,
    problemVersion: 1,
    lang: 'cpp',
    mode,
    codeR2Key: key,
    codeHash: 'h',
    codeBytes: stored.code.length,
  });
  return id;
}

const row = async (id: string) =>
  (await db.query.submission.findFirst({ where: eq(submission.id, id) }))!;
const progress = async () =>
  db.query.userProblem.findFirst({ where: eq(userProblem.userId, USER) });

describe.skipIf(!haveGpp())('judgeSubmission (Miniflare D1 + R2, local g++)', () => {
  it('records a wrong answer on a hidden test without storing hidden data', async () => {
    const id = await make('submit', { code: OVERFLOWS });
    expect(await judgeSubmission(deps, id)).toBe('judged');
    const s = await row(id);
    expect(s).toMatchObject({
      status: 'done',
      verdict: 'WA',
      passed: 2,
      total: 4,
      runtimeMs: null,
    });
    expect(s.report).toMatchObject({ failure: { index: 2, category: 'overflow' } });
    const stored = JSON.stringify(s.report);
    expect(stored).not.toContain('2147483647');
    expect(stored).not.toContain('4294967294');
    // Expected outputs never went to the box.
    expect(JSON.stringify(boxJobs.at(-1))).not.toContain('4294967294');
    expect(await progress()).toMatchObject({
      status: 'attempted',
      attempts: 1,
      wrongStreak: 1,
      firstTry: false,
    });
  });

  it('accepts, updating progress and the problem’s acceptance rate', async () => {
    const id = await make('submit', { code: CORRECT });
    await judgeSubmission(deps, id);
    const s = await row(id);
    expect(s).toMatchObject({ status: 'done', verdict: 'AC', passed: 4, total: 4 });
    expect(s.runtimeMs).toBeGreaterThanOrEqual(0);
    expect(await progress()).toMatchObject({
      status: 'solved',
      attempts: 2,
      wrongStreak: 0,
      firstTry: false,
    });
    expect((await progress())!.firstAcceptedAt).toBeInstanceOf(Date);
    expect((await progress())!.langsSolved).toBeGreaterThan(0);
    const p = (await db.query.problem.findFirst({ where: eq(problem.id, PROBLEM) }))!;
    expect(p).toMatchObject({ submissionCount: 2, acceptedCount: 1, acceptanceRate: 0.5 });
  });

  it('never judges the same submission twice', async () => {
    const id = await make('submit', { code: CORRECT });
    await judgeSubmission(deps, id);
    expect(await judgeSubmission(deps, id)).toBe('skipped');
    expect((await progress())!.attempts).toBe(3);
  });

  it('runs custom input, taking expected outputs from the reference solution', async () => {
    const before = boxJobs.length;
    const id = await make('run', {
      code: solution('return xs.size();'),
      customInput: '[1,2,3]\n\n[5,5]\n',
    });
    await judgeSubmission(deps, id);
    const s = await row(id);
    expect(s).toMatchObject({ status: 'done', verdict: 'WA', passed: 0, total: 2 });
    const cases = (s.report as { cases: Array<Record<string, unknown>> }).cases;
    // [1,2,3] is an example, so only [5,5] needed the reference.
    expect(cases).toEqual([
      expect.objectContaining({ verdict: 'WA', input: [[1, 2, 3]], expected: 6, actual: 3 }),
      expect.objectContaining({ verdict: 'WA', input: [[5, 5]], expected: 10, actual: 2 }),
    ]);
    expect(boxJobs.length - before).toBe(2);
    // Runs don't count as attempts.
    expect((await progress())!.attempts).toBe(3);
  });

  it('reports compile errors', async () => {
    const id = await make('run', { code: 'class Solution { int sumAll( };' });
    await judgeSubmission(deps, id);
    const s = await row(id);
    expect(s).toMatchObject({ status: 'done', verdict: 'CE' });
    expect(s.compileLog).toMatch(/solution\.cpp:1/);
  });

  it('fails cleanly when a problem has no hidden tests', async () => {
    await db.insert(problem).values({
      id: 'prb_0100',
      number: 100,
      slug: 'no-tests',
      title: 'No Tests',
      difficulty: 'Easy',
      difficultyDisplay: 'Easy',
      tags: ['Arrays'],
      status: 'published',
      license: 'CC-BY-SA-4.0',
    });
    const content = (await db.query.problemContent.findFirst())!;
    await db
      .insert(problemContent)
      .values({ ...content, problemId: 'prb_0100', createdAt: undefined as never });
    const id = await make('submit', { code: CORRECT }, 'prb_0100');
    await judgeSubmission(deps, id);
    expect(await row(id)).toMatchObject({ status: 'error', verdict: 'IE' });
  });

  it('surfaces box failures so the queue retries', async () => {
    const id = await make('submit', { code: CORRECT });
    const broken = { ...deps, runBox: async () => Promise.reject(new Error('box down')) };
    await expect(judgeSubmission(broken, id)).rejects.toThrow('box down');
    expect(await row(id)).toMatchObject({ status: 'running' });
    // The retry succeeds.
    await judgeSubmission(deps, id);
    expect(await row(id)).toMatchObject({ status: 'done', verdict: 'AC' });
  });
});
