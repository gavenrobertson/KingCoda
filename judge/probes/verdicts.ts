// End-to-end verdicts through a real judge box: judge-core builds the job, the box runs it in the
// sandbox, judge-core reads the result. node judge/probes/verdicts.ts [baseUrl]
import {
  buildJob,
  interpret,
  LARGEST_CATEGORY,
  type BoxResult,
  type JudgeCase,
  type Verdict,
} from '../../packages/judge-core/src/index.ts';
import type { Signature } from '../../packages/problem-schema/src/index.ts';

const base = process.argv[2] ?? 'http://localhost:18080';

const SIG: Signature = {
  function: 'sumAll',
  params: [{ name: 'xs', type: 'int[]' }],
  returns: 'long',
};
const big = Array.from({ length: 100_000 }, (_, i) => i * 7);
const cases: JudgeCase[] = [
  { args: [[1, 2, 3]], expected: 6 },
  { args: [[]], expected: 0, category: 'empty' },
  { args: [[2147483647, 2147483647]], expected: 4294967294, category: 'overflow' },
  { args: [big], expected: big.reduce((a, b) => a + b, 0), category: LARGEST_CATEGORY },
];
const solution = (body: string) =>
  `class Solution {\npublic:\n    long long sumAll(vector<int>& xs) {\n        ${body}\n    }\n};\n`;

const CHECKS: Array<{
  name: string;
  code: string;
  mode?: 'run' | 'submit';
  expect: Partial<Verdict> & { index?: number };
}> = [
  {
    name: 'correct solution is accepted',
    code: solution('long long s = 0; for (int x : xs) s += x; return s;'),
    expect: { verdict: 'AC', passed: 4 },
  },
  {
    name: '32-bit overflow is a wrong answer',
    code: solution('int s = 0; for (int x : xs) s += x; return s;'),
    expect: { verdict: 'WA', index: 2 },
  },
  {
    name: 'infinite loop on the largest input times out',
    code: solution(
      'volatile long long s = 0; if (xs.size() > 1000) for (;;) s = s + 1; for (int x : xs) s = s + x; return s;',
    ),
    expect: { verdict: 'TLE', index: 3 },
  },
  {
    name: 'huge allocation exceeds memory',
    code: solution(
      'if (xs.size() > 1000) { vector<long long> v(400000000, 1); return v[xs.size()]; } long long s = 0; for (int x : xs) s += x; return s;',
    ),
    expect: { verdict: 'MLE', index: 3 },
  },
  {
    name: 'null dereference is a runtime error',
    code: solution(
      'if (xs.empty()) { int *p = nullptr; return *p; } long long s = 0; for (int x : xs) s += x; return s;',
    ),
    expect: { verdict: 'RE', index: 1 },
  },
  {
    name: 'syntax error is a compile error',
    code: 'class Solution {\npublic:\n    long long sumAll(vector<int>& xs) { return xs.size() }\n};\n',
    expect: { verdict: 'CE' },
  },
  {
    name: 'missing return is a compile error, not undefined behaviour',
    code: solution(''),
    expect: { verdict: 'CE' },
  },
  {
    name: 'Run shows the diff',
    code: solution('return 7;'),
    mode: 'run',
    expect: { verdict: 'WA', passed: 0 },
  },
];

let failed = 0;
for (const c of CHECKS) {
  const mode = c.mode ?? 'submit';
  const plan = buildJob({
    id: `v-${CHECKS.indexOf(c)}`,
    signature: SIG,
    lang: 'cpp',
    code: c.code,
    cases,
    publicCount: mode === 'run' ? cases.length : 0,
    limits: { timeMs: 1000, memoryMb: 256 },
    mode,
  });
  const t0 = performance.now();
  const res = await fetch(`${base}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(plan.job),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const box = (await res.json()) as BoxResult;
  const ms = Math.round(performance.now() - t0);
  const v = interpret(plan, box, cases, { checker: { kind: 'exact' } });
  const { index, ...rest } = c.expect;
  const ok =
    Object.entries(rest).every(([k, want]) => v[k as keyof Verdict] === want) &&
    (index === undefined || v.failure?.index === index);
  if (!ok) failed++;
  const compileMs = box.compile?.wallMs ?? 0;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.name}  (${v.verdict}, compile ${compileMs}ms, total ${ms}ms)`,
  );
  if (!ok) console.log('      ' + JSON.stringify({ ...v, cases: undefined }).slice(0, 600));
}
console.log(`\n${CHECKS.length - failed}/${CHECKS.length} verdict checks passed`);
process.exit(failed ? 1 : 0);
