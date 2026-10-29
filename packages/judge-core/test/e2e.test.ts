import { describe, expect, it } from 'vitest';
import type { Checker, Signature } from '@kingcoda/problem-schema';
import { buildJob, interpret, LARGEST_CATEGORY, type JudgeCase } from '../src/index.ts';
import { haveGpp, runLocalBox } from './local-box.ts';

const SIG: Signature = {
  function: 'sumAll',
  params: [{ name: 'xs', type: 'int[]' }],
  returns: 'long',
};
const big = Array.from({ length: 50_000 }, (_, i) => i);
const cases: JudgeCase[] = [
  { args: [[1, 2, 3]], expected: 6 },
  { args: [[]], expected: 0, category: 'empty' },
  { args: [[2147483647, 2147483647]], expected: 4294967294, category: 'overflow' },
  { args: [big], expected: big.reduce((a, b) => a + b, 0), category: LARGEST_CATEGORY },
];
const exact: Checker = { kind: 'exact' };

function judge(code: string, mode: 'run' | 'submit' = 'submit') {
  const plan = buildJob({
    id: 'e2e',
    signature: SIG,
    lang: 'cpp',
    code,
    cases,
    limits: { timeMs: 2000, memoryMb: 256 },
    mode,
  });
  return interpret(plan, runLocalBox(plan.job), cases, { checker: exact, reveal: mode === 'run' });
}

const solution = (body: string) =>
  `class Solution {\npublic:\n    long long sumAll(vector<int>& xs) {\n${body}\n    }\n};\n`;

describe.skipIf(!haveGpp())('C++ end to end (local g++, no sandbox)', () => {
  it('accepts a correct solution', () => {
    expect(
      judge(solution('        long long s = 0; for (int x : xs) s += x; return s;')),
    ).toMatchObject({ verdict: 'AC', passed: 4, total: 4 });
  });

  it('catches 32-bit overflow as a wrong answer on the labelled case', () => {
    const v = judge(solution('        int s = 0; for (int x : xs) s += x; return s;'));
    expect(v).toMatchObject({
      verdict: 'WA',
      passed: 2,
      failure: { index: 2, category: 'overflow' },
    });
  });

  it('times out on the largest input only', () => {
    const v = judge(
      solution(
        '        volatile long long s = 0; if (xs.size() > 1000) for (;;) s = s + 1; for (int x : xs) s = s + x; return s;',
      ),
    );
    expect(v).toMatchObject({
      verdict: 'TLE',
      passed: 3,
      failure: { index: 3, category: LARGEST_CATEGORY },
    });
  });

  it('reports compile errors against solution.cpp line numbers', () => {
    const v = judge(
      'class Solution {\npublic:\n    long long sumAll(vector<int>& xs) { return xs.size() }\n};\n',
    );
    expect(v.verdict).toBe('CE');
    expect(v.compileOutput).toMatch(/solution\.cpp:3:\d+/);
  });

  it('reports a crash as a runtime error without leaking stderr on hidden tests', () => {
    const v = judge(
      solution(
        '        if (xs.empty()) throw out_of_range("leak " + to_string(xs.size())); return 1;',
      ),
    );
    expect(v).toMatchObject({ verdict: 'WA', failure: { index: 0 } });
    const crash = judge(
      solution(
        '        if (xs.empty()) throw out_of_range("leak"); long long s = 0; for (int x : xs) s += x; return s;',
      ),
    );
    expect(crash).toMatchObject({
      verdict: 'RE',
      passed: 1,
      failure: { index: 1, category: 'empty' },
    });
    expect(JSON.stringify(crash)).not.toContain('leak');
  });

  it('shows printing and the diff on a Run', () => {
    const v = judge(solution('        cout << "n=" << xs.size() << endl; return 7;'), 'run');
    expect(v.verdict).toBe('WA');
    expect(v.cases![0]).toMatchObject({ verdict: 'WA', expected: 6, actual: 7, printed: 'n=3\n' });
  });
});
