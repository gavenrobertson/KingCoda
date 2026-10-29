import { groupCases, LARGEST_CATEGORY } from '@kingcoda/judge-core';
import { conforms, outputsMatch, type Problem, type TestCase } from '@kingcoda/problem-schema';
import { CompiledCpp } from './cpp.ts';
import { loadPackage, type Package } from './load.ts';
import { bruteOutputs, edgeCases, randomCases, type Args } from './python.ts';

export interface BuiltProblem {
  pkg: Package;
  samples: TestCase[];
  hidden: TestCase[];
  referenceMs: number;
}

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const BRUTE_CASES = 300;
const MIN_EDGE_CASES = 3;

function positional(meta: Problem, args: Args): unknown[] {
  return meta.signature.params.map((p) => args[p.name]);
}

function argsConform(meta: Problem, args: Args): string | null {
  for (const p of meta.signature.params) {
    if (!(p.name in args)) return `missing arg ${p.name}`;
    if (!conforms(args[p.name], p.type))
      return `${p.name} is not a valid ${p.type}: ${JSON.stringify(args[p.name]).slice(0, 120)}`;
  }
  const extra = Object.keys(args).filter((k) => !meta.signature.params.some((p) => p.name === k));
  return extra.length ? `unexpected args ${extra.join(', ')}` : null;
}

const short = (v: unknown) => JSON.stringify(v).slice(0, 160);

/**
 * Validates one package and, if every check passes, returns its built test suites.
 * Phase 2 checks: schema, examples vs reference, generator coverage and type conformance,
 * brute force agreement, hidden-suite build and reference time budget.
 */
export function validatePackage(dir: string): { checks: Check[]; built?: BuiltProblem } {
  const checks: Check[] = [];
  const fail = (name: string, detail: string) => {
    checks.push({ name, ok: false, detail });
    return { checks };
  };
  const pass = (name: string, detail?: string) => checks.push({ name, ok: true, detail });

  let pkg: Package;
  try {
    pkg = loadPackage(dir);
  } catch (e) {
    return fail('package', (e as Error).message);
  }
  pass('package');
  const { meta } = pkg;
  const checker = meta.checker;

  let ref: CompiledCpp;
  try {
    ref = CompiledCpp.compile(meta.signature, pkg.reference);
  } catch (e) {
    return fail('reference compiles', (e as Error).message);
  }

  try {
    // 1. Examples
    for (const [i, ex] of meta.examples.entries()) {
      const bad =
        argsConform(meta, ex.args) ??
        (conforms(ex.output, meta.signature.returns)
          ? null
          : `output is not a ${meta.signature.returns}`);
      if (bad) return fail('examples are well-typed', `example ${i + 1}: ${bad}`);
    }
    const samples: TestCase[] = meta.examples.map((ex) => ({
      args: positional(meta, ex.args),
      expected: ex.output,
    }));
    const exOut = ref.run(samples).outputs;
    for (const [i, s] of samples.entries()) {
      if (!outputsMatch(checker, s.expected, exOut[i])) {
        return fail(
          'reference passes examples',
          `example ${i + 1}: expected ${short(s.expected)}, reference gave ${short(exOut[i])}`,
        );
      }
    }
    pass('reference passes examples', `${samples.length} examples`);

    // 2. Generator: edge cases + random sizes, all well-typed
    const seed = meta.number * 7919;
    const edges = edgeCases(dir);
    if (edges.length < MIN_EDGE_CASES)
      return fail(
        'generator edge cases',
        `only ${edges.length} edge cases (need ${MIN_EDGE_CASES})`,
      );
    const small = randomCases(dir, 'small', seed, BRUTE_CASES);
    const medium = randomCases(dir, 'medium', seed + 1, meta.tests.random);
    const max = randomCases(dir, 'max', seed + 2, meta.tests.max);
    for (const [label, list] of [
      ['edge', edges.map((e) => e.args)],
      ['small', small],
      ['medium', medium],
      ['max', max],
    ] as const) {
      for (const [i, args] of list.entries()) {
        const bad = argsConform(meta, args);
        if (bad) return fail('generated tests are well-typed', `${label} #${i}: ${bad}`);
      }
    }
    const again = randomCases(dir, 'medium', seed + 1, meta.tests.random);
    if (JSON.stringify(again) !== JSON.stringify(medium))
      return fail('generator is deterministic', 'same seed gave different cases');
    pass(
      'generator',
      `${edges.length} edge, ${medium.length} random, ${max.length} max; deterministic`,
    );

    // 3. Brute force agreement on small inputs (plus edge cases, which are small by design)
    const agreeSet = [...edges.map((e) => e.args), ...small];
    const brute = bruteOutputs(dir, agreeSet);
    const refSmall = ref.run(agreeSet.map((a) => ({ args: positional(meta, a) }))).outputs;
    for (const [i, args] of agreeSet.entries()) {
      if (!outputsMatch(checker, brute[i], refSmall[i])) {
        return fail(
          'brute force agrees',
          `input ${short(args)}: brute ${short(brute[i])}, reference ${short(refSmall[i])}`,
        );
      }
    }
    pass('brute force agrees', `${agreeSet.length} inputs`);

    // 4. Hidden suite: edges + random + max, expected from the reference
    const hiddenArgs: Array<{ args: unknown[]; category?: string }> = [
      ...edges.map((e) => ({ args: positional(meta, e.args), category: e.category })),
      ...medium.map((a) => ({ args: positional(meta, a), category: 'random' })),
      ...max.map((a) => ({ args: positional(meta, a), category: LARGEST_CATEGORY })),
    ];
    // Run the suite in the judge's process groups: each group gets the full time limit there.
    const outputs: unknown[] = [];
    let ms = 0;
    for (const g of groupCases(hiddenArgs)) {
      const run = ref.run(hiddenArgs.slice(g.start, g.start + g.count));
      outputs.push(...run.outputs);
      ms = Math.max(ms, run.ms);
    }
    for (const [i, out] of outputs.entries()) {
      if (!conforms(out, meta.signature.returns))
        return fail('reference output is well-typed', `case ${i}: ${short(out)}`);
    }
    // Unsandboxed wall time is a rough proxy; Phase 3 calibrates limits inside the judge image.
    if (ms > meta.limits.timeMs / 2) {
      return fail(
        'reference fits the time limit',
        `${ms.toFixed(0)} ms for the slowest test process, limit ${meta.limits.timeMs} ms needs 2x headroom`,
      );
    }
    pass(
      'reference fits the time limit',
      `slowest test process ${ms.toFixed(0)} ms of ${meta.limits.timeMs} ms`,
    );

    const hidden = hiddenArgs.map((c, i) => ({ ...c, expected: outputs[i] }));
    return { checks, built: { pkg, samples, hidden, referenceMs: ms } };
  } catch (e) {
    return fail('pipeline', (e as Error).message);
  } finally {
    ref.dispose();
  }
}
