import { parseOutput } from '@kingcoda/harness';
import { outputsMatch, type Checker } from '@kingcoda/problem-schema';
import type { BoxResult, BoxStep } from './box.ts';
import type { JobPlan, JudgeCase } from './plan.ts';

export type VerdictCode = 'AC' | 'WA' | 'TLE' | 'MLE' | 'OLE' | 'RE' | 'CE' | 'IE';

/** One case of a Run (sample or custom input): everything is the user's to see. */
export interface CaseReport {
  index: number;
  verdict: VerdictCode;
  input: unknown[];
  /** Absent when no expected output is known (custom input without a reference result). */
  expected?: unknown;
  actual?: unknown;
  /** What the user's code printed while this case ran. */
  printed: string;
  message?: string;
}

/**
 * The first failing case. On hidden tests only the position, the edge-case label and a fixed
 * message are kept: never the input, expected or actual output, printing or stderr, all of which
 * user code can derive from the hidden input.
 */
export interface Failure {
  index: number;
  category?: string;
  message?: string;
  input?: unknown[];
  expected?: unknown;
  actual?: unknown;
  printed?: string;
}

export interface Verdict {
  verdict: VerdictCode;
  passed: number;
  total: number;
  /** Sum of CPU time over the test processes. */
  runtimeMs: number;
  /** Peak resident memory of any test process. */
  memoryKb: number;
  compileOutput?: string;
  failure?: Failure;
  /** Reports for the public cases that ran. */
  cases?: CaseReport[];
}

export interface InterpretOptions {
  checker: Checker;
}

const MESSAGE_MAX = 4 << 10;

function clip(s: string, max = MESSAGE_MAX): string {
  return s.length > max ? s.slice(0, max) + '\n… (truncated)' : s;
}

const STATUS_VERDICT = { tle: 'TLE', mle: 'MLE', ole: 'OLE', re: 'RE' } as const;

const FIXED_MESSAGE: Record<'TLE' | 'MLE' | 'OLE', string> = {
  TLE: 'Time limit exceeded',
  MLE: 'Memory limit exceeded',
  OLE: 'Output limit exceeded: the program printed too much',
};

function signalText(step: BoxStep): string {
  if (step.signal) return `Killed by signal: ${step.signal}`;
  return `Exited with status ${step.exitCode}`;
}

/** Why a process stopped early, worded for hidden tests unless `reveal`. */
function stepFailure(step: BoxStep, reveal: boolean): { verdict: VerdictCode; message: string } {
  if (step.status === 'ok')
    return { verdict: 'RE', message: 'The program exited before returning a result' };
  if (step.status === 'tle' || step.status === 'mle' || step.status === 'ole') {
    const verdict = STATUS_VERDICT[step.status];
    return { verdict, message: FIXED_MESSAGE[verdict] };
  }
  if (step.status === 're') {
    const stderr = step.stderr.trim();
    return {
      verdict: 'RE',
      message: reveal && stderr ? clip(stderr) : signalText(step),
    };
  }
  return { verdict: 'IE', message: 'The judge could not run this test' };
}

const ie = (total: number, message: string): Verdict => ({
  verdict: 'IE',
  passed: 0,
  total,
  runtimeMs: 0,
  memoryKb: 0,
  failure: { index: 0, message },
});

/** Turns the box's raw output into a verdict, comparing results to expected outputs here. */
export function interpret(
  plan: JobPlan,
  result: BoxResult,
  cases: JudgeCase[],
  opts: InterpretOptions,
): Verdict {
  const total = cases.length;
  if (result.compile && result.compile.status !== 'ok') {
    if (result.compile.status !== 'ce') return ie(total, 'The judge could not compile this code');
    return {
      verdict: 'CE',
      passed: 0,
      total,
      runtimeMs: 0,
      memoryKb: 0,
      compileOutput: clip(
        (result.compile.stderr || result.compile.stdout).trim() || 'Compilation failed',
        16 << 10,
      ),
    };
  }

  let runtimeMs = 0;
  let memoryKb = 0;
  let failure: (Failure & { verdict: VerdictCode }) | undefined;
  const reports: CaseReport[] = [];

  const fail = (f: Failure & { verdict: VerdictCode }) => {
    failure ??= f;
  };

  for (const [gi, group] of plan.groups.entries()) {
    const step = result.tests[gi];
    if (!step) {
      if (failure) break; // stopOnFailure skipped the rest
      return ie(total, 'The judge returned fewer results than tests');
    }
    if (step.status === 'sandbox_fail') return ie(total, 'The judge sandbox failed');
    runtimeMs += step.cpuMs;
    memoryKb = Math.max(memoryKb, step.maxRssKb);

    const reveal = group.public;
    const report = (r: CaseReport) => {
      if (reveal) reports.push(r);
    };
    const out = parseOutput(step.stdout);
    for (let k = 0; k < group.count; k++) {
      const index = group.start + k;
      const c = cases[index]!;
      const printed = out.printed[k] ?? '';
      const visible = reveal ? { input: c.args, expected: c.expected } : {};

      if (k < out.results.length) {
        const actual = out.results[k];
        const ok = c.expected === undefined || outputsMatch(opts.checker, c.expected, actual);
        if (!ok)
          fail({
            verdict: 'WA',
            index,
            category: c.category,
            ...visible,
            ...(reveal ? { actual, printed } : {}),
          });
        report({
          index,
          verdict: ok ? 'AC' : 'WA',
          input: c.args,
          expected: c.expected,
          actual,
          printed,
        });
        continue;
      }

      // No result for this case: the process stopped here (or garbled its output).
      const why = out.malformed
        ? { verdict: 'RE' as const, message: 'Output contained the reserved character \\x1e' }
        : stepFailure(step, reveal);
      fail({
        ...why,
        index,
        category: c.category,
        ...visible,
        ...(reveal ? { printed } : {}),
      });
      report({
        index,
        verdict: why.verdict,
        input: c.args,
        expected: c.expected,
        printed,
        message: why.message,
      });
      // Later cases in this process never ran.
      for (let rest = k + 1; rest < group.count; rest++) {
        const later = cases[group.start + rest]!;
        report({
          index: group.start + rest,
          verdict: why.verdict,
          input: later.args,
          expected: later.expected,
          printed: '',
          message: 'Not run',
        });
      }
      break;
    }

    // Every result arrived but the process still failed afterwards (e.g. too slow to exit).
    if (out.results.length >= group.count && step.status !== 'ok') {
      const index = group.start + group.count - 1;
      const why = stepFailure(step, reveal);
      fail({ ...why, index, category: cases[index]!.category });
      const last = reports[reports.length - 1];
      if (reveal && last?.verdict === 'AC')
        Object.assign(last, { verdict: why.verdict, message: why.message });
    }
  }

  if (failure) {
    const { verdict, ...rest } = failure;
    // Run reports every public case. Submit stops at the first failure, and cases run in order,
    // so everything before it passed.
    const passed = plan.job.stopOnFailure
      ? rest.index
      : reports.filter((r) => r.verdict === 'AC').length;
    return {
      verdict,
      passed,
      total,
      runtimeMs,
      memoryKb,
      failure: rest,
      ...(reports.length ? { cases: reports } : {}),
    };
  }
  return {
    verdict: 'AC',
    passed: total,
    total,
    runtimeMs,
    memoryKb,
    ...(reports.length ? { cases: reports } : {}),
  };
}
