import { describe, expect, it } from 'vitest';
import { conforms, problemSchema, pythonName } from '../src/index.ts';

const valid = {
  number: 3,
  slug: 'longest-calm-stretch',
  title: 'Longest Calm Stretch',
  difficulty: 'Medium',
  tags: ['Sliding Window', 'Deque'],
  signature: {
    function: 'longestCalm',
    params: [
      { name: 'speeds', type: 'int[]' },
      { name: 'k', type: 'int' },
    ],
    returns: 'int',
  },
  limits: { timeMs: 1000, memoryMb: 256 },
  constraints: ['1 ≤ speeds.length ≤ 10⁵'],
  examples: [{ args: { speeds: [3, 6, 5, 7, 12, 11], k: 4 }, output: 4 }],
  hints: [
    { text: 'Track the max and min of the current window.', unlockAfterWrong: 2 },
    { text: 'Two monotonic deques give both in O(1).', unlockAfterWrong: 4 },
  ],
  license: 'CC-BY-SA-4.0',
  source: 'Original KingCoda problem',
};

describe('problemSchema', () => {
  it('accepts a valid problem and fills defaults', () => {
    const p = problemSchema.parse(valid);
    expect(p.checker).toEqual({ kind: 'exact' });
    expect(p.tests).toEqual({ random: 40, max: 3 });
  });

  it('rejects examples whose args do not match the signature', () => {
    const bad = { ...valid, examples: [{ args: { speeds: [1] }, output: 1 }] };
    expect(problemSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects hints that unlock out of order', () => {
    const bad = { ...valid, hints: [valid.hints[1], valid.hints[0]] };
    expect(problemSchema.safeParse(bad).success).toBe(false);
  });

  it('requires a licence', () => {
    const { license: _drop, ...bad } = valid;
    expect(problemSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown keys (typos fail loudly)', () => {
    expect(problemSchema.safeParse({ ...valid, dificulty: 'Hard' }).success).toBe(false);
  });
});

describe('conforms', () => {
  it.each([
    [5, 'int', true],
    [2 ** 31, 'int', false],
    [1.5, 'int', false],
    [2 ** 40, 'long', true],
    [2 ** 60, 'long', false],
    [[1, 2], 'int[]', true],
    [[[1], [2, 3]], 'int[][]', true],
    [[['a']], 'string[][]', true],
    [[1, null, 2], 'TreeNode', true],
    [[null, 1], 'TreeNode', false],
    [[], 'TreeNode', true],
    [[1, 2], 'ListNode', true],
    [true, 'bool', true],
    [Number.NaN, 'double', false],
  ] as const)('%j as %s → %s', (value, type, ok) => {
    expect(conforms(value, type)).toBe(ok);
  });
});

describe('pythonName', () => {
  it.each([
    ['longestCalm', 'longest_calm'],
    ['twoSum', 'two_sum'],
    ['k', 'k'],
    ['maxXORPair', 'max_xor_pair'],
  ])('%s → %s', (a, b) => expect(pythonName(a)).toBe(b));
});
