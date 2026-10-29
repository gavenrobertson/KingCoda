import type { Checker } from './problem.ts';

/** Stable JSON for comparison: object keys sorted, -0 normalised. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'number' && Object.is(v, -0)) return 0;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    }
    return v;
  });
}

function floatEqual(a: unknown, b: unknown, tol: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => floatEqual(x, b[i], tol));
  return canonical(a) === canonical(b);
}

/** Does `actual` match `expected` under the problem's checker? Shared by the pipeline and the judge. */
export function outputsMatch(checker: Checker, expected: unknown, actual: unknown): boolean {
  switch (checker.kind) {
    case 'exact':
      return canonical(expected) === canonical(actual);
    case 'float':
      return floatEqual(expected, actual, checker.tolerance);
    case 'unordered': {
      if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length)
        return false;
      const sort = (xs: unknown[]) => xs.map(canonical).sort();
      const [e, a] = [sort(expected), sort(actual)];
      return e.every((x, i) => x === a[i]);
    }
  }
}
