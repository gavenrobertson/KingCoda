import { describe, expect, it } from 'vitest';
import { formatCustomInput, parseCustomInput } from '../src/index.ts';
import { SIG } from './fixtures.ts';

describe('parseCustomInput', () => {
  it('reads one value per parameter line, several tests back to back', () => {
    expect(parseCustomInput(SIG, '[1,2,3]\n4\n\n[]\n0\n')).toEqual({
      ok: true,
      cases: [
        [[1, 2, 3], 4],
        [[], 0],
      ],
    });
  });

  it('round-trips with formatCustomInput', () => {
    const cases = [
      [[5, -1], 2],
      [[7], 1],
    ];
    expect(parseCustomInput(SIG, formatCustomInput(cases))).toEqual({ ok: true, cases });
  });

  it('explains bad input', () => {
    expect(parseCustomInput(SIG, '')).toMatchObject({ ok: false, error: 'Custom input is empty' });
    expect(parseCustomInput(SIG, '[1]\n')).toMatchObject({
      ok: false,
      error: expect.stringContaining('2 lines per test (xs, k)'),
    });
    expect(parseCustomInput(SIG, '[1,\n2\n')).toMatchObject({
      ok: false,
      error: 'Test 1, xs: not valid JSON',
    });
    expect(parseCustomInput(SIG, '[1]\n2.5\n')).toMatchObject({
      ok: false,
      error: 'Test 1, k: expected int',
    });
    expect(parseCustomInput(SIG, '[1]\n1\n'.repeat(11))).toMatchObject({
      ok: false,
      error: expect.stringContaining('At most 10'),
    });
  });
});
