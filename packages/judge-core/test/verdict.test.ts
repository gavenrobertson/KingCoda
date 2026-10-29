import { describe, expect, it } from 'vitest';
import type { Checker } from '@kingcoda/problem-schema';
import {
  buildJob,
  interpret,
  LARGEST_CATEGORY,
  type BoxResult,
  type JudgeCase,
} from '../src/index.ts';
import { rec, SIG, step } from './fixtures.ts';

const exact: Checker = { kind: 'exact' };
const cases: JudgeCase[] = [
  { args: [[1], 1], expected: 1, category: 'one coin' },
  { args: [[2], 1], expected: 2 },
  { args: [[3], 1], expected: 3, category: LARGEST_CATEGORY },
  { args: [[4], 1], expected: 4, category: LARGEST_CATEGORY },
];
const plan = (mode: 'run' | 'submit' = 'submit') =>
  buildJob({
    id: 'j',
    signature: SIG,
    lang: 'cpp',
    code: '',
    cases,
    publicCount: mode === 'run' ? cases.length : 0,
    limits: { timeMs: 1000, memoryMb: 256 },
    mode,
  });
const box = (tests: BoxResult['tests'], compile = step()): BoxResult => ({
  id: 'j',
  compile,
  tests,
  strays: 0,
});
const hidden = { checker: exact };
const shown = hidden;

describe('interpret', () => {
  it('accepts, summing CPU time and taking peak memory', () => {
    const v = interpret(
      plan(),
      box([
        step({ stdout: rec(1) + rec(2), cpuMs: 3 }),
        step({ stdout: rec(3), cpuMs: 40, maxRssKb: 9000 }),
        step({ stdout: rec(4) }),
      ]),
      cases,
      hidden,
    );
    expect(v).toMatchObject({ verdict: 'AC', passed: 4, total: 4, runtimeMs: 48, memoryKb: 9000 });
    expect(v.failure).toBeUndefined();
    expect(v.cases).toBeUndefined();
  });

  it('reports compile errors with the compiler output', () => {
    const v = interpret(
      plan(),
      box([], step({ status: 'ce', stderr: "solution.cpp:3:1: error: expected ';'" })),
      cases,
      hidden,
    );
    expect(v).toMatchObject({ verdict: 'CE', passed: 0 });
    expect(v.compileOutput).toContain('solution.cpp:3:1');
  });

  it('treats sandbox failures as internal errors, never as the user’s fault', () => {
    expect(
      interpret(plan(), box([], step({ status: 'sandbox_fail' })), cases, hidden).verdict,
    ).toBe('IE');
    expect(interpret(plan(), box([step({ status: 'sandbox_fail' })]), cases, hidden).verdict).toBe(
      'IE',
    );
    expect(interpret(plan(), box([]), cases, hidden).verdict).toBe('IE');
  });

  it('hides everything about a failing hidden test except its position and label', () => {
    const v = interpret(
      plan(),
      box([
        step({ stdout: 'debug [1]\n' + rec(99) + rec(2) }),
        step({ stdout: rec(3) }),
        step({ stdout: rec(4) }),
      ]),
      cases,
      hidden,
    );
    expect(v).toMatchObject({
      verdict: 'WA',
      passed: 0,
      failure: { index: 0, category: 'one coin' },
    });
    expect(v.failure).not.toHaveProperty('input');
    expect(v.failure).not.toHaveProperty('actual');
    expect(v.failure).not.toHaveProperty('expected');
    expect(v.failure).not.toHaveProperty('printed');
  });

  it('shows the diff and printing on a sample run', () => {
    const v = interpret(
      plan('run'),
      box([step({ stdout: rec(1) + 'hi\n' + rec(7) + rec(3) + rec(4) })]),
      cases,
      shown,
    );
    expect(v).toMatchObject({
      verdict: 'WA',
      passed: 3,
      failure: { index: 1, input: [[2], 1], expected: 2, actual: 7, printed: 'hi\n' },
    });
    expect(v.cases!.map((c) => c.verdict)).toEqual(['AC', 'WA', 'AC', 'AC']);
  });

  it('places a time-out on the case that was running', () => {
    const v = interpret(plan(), box([step({ stdout: rec(1), status: 'tle' })]), cases, hidden);
    expect(v).toMatchObject({
      verdict: 'TLE',
      passed: 1,
      failure: { index: 1, message: 'Time limit exceeded' },
    });
  });

  it('reports a failure in a later process after earlier ones passed', () => {
    const v = interpret(
      plan(),
      box([step({ stdout: rec(1) + rec(2) }), step({ status: 'mle' })]),
      cases,
      hidden,
    );
    expect(v).toMatchObject({
      verdict: 'MLE',
      passed: 2,
      failure: { index: 2, category: LARGEST_CATEGORY },
    });
  });

  it('keeps stderr out of hidden runtime errors but shows it on sample runs', () => {
    const crash = step({
      status: 're',
      signal: 'segmentation fault',
      exitCode: -1,
      stderr: 'input was [3]',
    });
    const h = interpret(plan(), box([step({ stdout: rec(1) + rec(2) }), crash]), cases, hidden);
    expect(h).toMatchObject({
      verdict: 'RE',
      failure: { index: 2, message: 'Killed by signal: segmentation fault' },
    });
    expect(JSON.stringify(h)).not.toContain('input was');

    const s = interpret(plan('run'), box([step({ ...crash, stdout: rec(1) })]), cases, shown);
    expect(s).toMatchObject({ verdict: 'RE', failure: { index: 1, message: 'input was [3]' } });
    expect(s.cases!.map((c) => c.verdict)).toEqual(['AC', 'RE', 'RE', 'RE']);
  });

  it('counts a clean exit with missing results as a runtime error', () => {
    const v = interpret(plan(), box([step({ stdout: rec(1) })]), cases, hidden);
    expect(v).toMatchObject({
      verdict: 'RE',
      failure: { index: 1, message: 'The program exited before returning a result' },
    });
  });

  it('rejects output that forges the record separator', () => {
    const v = interpret(plan(), box([step({ stdout: rec(1) + '\x1enot json\n' })]), cases, hidden);
    expect(v).toMatchObject({ verdict: 'RE', failure: { index: 1 } });
  });

  it('fails a process that printed every result but then ran out of time', () => {
    const v = interpret(
      plan(),
      box([step({ stdout: rec(1) + rec(2) }), step({ stdout: rec(3), status: 'tle' })]),
      cases,
      hidden,
    );
    expect(v).toMatchObject({ verdict: 'TLE', passed: 2, failure: { index: 2 } });
  });

  it('reports the earliest failure when later processes were skipped', () => {
    const v = interpret(
      plan(),
      box([step({ stdout: rec(1) + rec(5) }), step({ status: 'tle' })]),
      cases,
      hidden,
    );
    expect(v).toMatchObject({ verdict: 'WA', passed: 1, failure: { index: 1 } });
  });

  it('uses the problem’s checker', () => {
    const fcases: JudgeCase[] = [{ args: [[1], 1], expected: 0.1 }];
    const p = buildJob({
      id: 'j',
      signature: SIG,
      lang: 'cpp',
      code: '',
      cases: fcases,
      publicCount: 0,
      limits: { timeMs: 1000, memoryMb: 256 },
      mode: 'submit',
    });
    const result = box([step({ stdout: rec(0.1000000001) })]);
    expect(
      interpret(p, result, fcases, { checker: { kind: 'float', tolerance: 1e-6 } }).verdict,
    ).toBe('AC');
    expect(interpret(p, result, fcases, hidden).verdict).toBe('WA');
  });

  it('accepts any result for custom input without an expected output', () => {
    const custom: JudgeCase[] = [{ args: [[1], 1] }];
    const p = buildJob({
      id: 'j',
      signature: SIG,
      lang: 'cpp',
      code: '',
      cases: custom,
      publicCount: 1,
      limits: { timeMs: 1000, memoryMb: 256 },
      mode: 'run',
    });
    const v = interpret(p, box([step({ stdout: rec(42) })]), custom, shown);
    expect(v.verdict).toBe('AC');
    expect(v.cases![0]).toMatchObject({ actual: 42 });
    expect(v.cases![0]!.expected).toBeUndefined();
  });

  it('shows the diff for a failing example on Submit, but nothing from hidden tests', () => {
    const p = buildJob({
      id: 'j',
      signature: SIG,
      lang: 'cpp',
      code: '',
      cases,
      publicCount: 1,
      limits: { timeMs: 1000, memoryMb: 256 },
      mode: 'submit',
    });
    const wrongExample = interpret(
      p,
      box([
        step({ stdout: rec(5) }),
        step({ stdout: rec(2) }),
        step({ stdout: rec(3) }),
        step({ stdout: rec(4) }),
      ]),
      cases,
      hidden,
    );
    expect(wrongExample).toMatchObject({
      verdict: 'WA',
      passed: 0,
      failure: { index: 0, input: [[1], 1], expected: 1, actual: 5 },
    });
    expect(wrongExample.cases).toHaveLength(1);

    const wrongHidden = interpret(
      p,
      box([
        step({ stdout: rec(1) }),
        step({ stdout: rec(9) }),
        step({ stdout: rec(3) }),
        step({ stdout: rec(4) }),
      ]),
      cases,
      hidden,
    );
    expect(wrongHidden).toMatchObject({ verdict: 'WA', passed: 1, failure: { index: 1 } });
    expect(wrongHidden.failure).not.toHaveProperty('actual');
    expect(wrongHidden.cases).toHaveLength(1);
  });
});
