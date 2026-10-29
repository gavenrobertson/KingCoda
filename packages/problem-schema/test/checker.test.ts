import { describe, expect, it } from 'vitest';
import { outputsMatch } from '../src/index.ts';

describe('outputsMatch', () => {
  it('exact: deep equality, order matters', () => {
    expect(outputsMatch({ kind: 'exact' }, [1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(outputsMatch({ kind: 'exact' }, [1, 2], [2, 1])).toBe(false);
    expect(outputsMatch({ kind: 'exact' }, 0, -0)).toBe(true);
    expect(outputsMatch({ kind: 'exact' }, true, 1)).toBe(false);
    expect(outputsMatch({ kind: 'exact' }, 'a', 'a ')).toBe(false);
  });
  it('float: relative/absolute tolerance, recursively', () => {
    const c = { kind: 'float', tolerance: 1e-5 } as const;
    expect(outputsMatch(c, 2.5, 2.500001)).toBe(true);
    expect(outputsMatch(c, [1e9, 0.1], [1e9 + 1, 0.100001])).toBe(true);
    expect(outputsMatch(c, 1, 1.01)).toBe(false);
    expect(outputsMatch(c, [1, 2], [1])).toBe(false);
  });
  it('unordered: top-level order ignored, inner order kept', () => {
    const c = { kind: 'unordered' } as const;
    expect(outputsMatch(c, [[1, 2], [3]], [[3], [1, 2]])).toBe(true);
    expect(outputsMatch(c, [[1, 2]], [[2, 1]])).toBe(false);
    expect(outputsMatch(c, [1, 1, 2], [1, 2, 2])).toBe(false);
  });
});
