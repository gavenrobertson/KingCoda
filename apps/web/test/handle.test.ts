import { describe, expect, it } from 'vitest';
import { handleSchema, suggestHandle } from '../src/lib/handle';
import { parseTheme } from '../src/lib/theme';

describe('handleSchema', () => {
  it.each(['mara', 'mquinn_42', 'king-coda', 'abc', 'a1b2c3d4e5f6g7h8i9j0'])('accepts %s', (h) => {
    expect(handleSchema.safeParse(h).success).toBe(true);
  });

  it('normalises case and whitespace', () => {
    expect(handleSchema.parse('  MaraQ ')).toBe('maraq');
  });

  it.each([
    ['ab', 'At least 3 characters.'],
    ['a'.repeat(21), 'At most 20 characters.'],
    ['-mara', 'Letters, numbers'],
    ['mara_', 'Letters, numbers'],
    ['ma ra', 'Letters, numbers'],
    ['mära', 'Letters, numbers'],
    ['admin', 'That handle is reserved.'],
    ['Problems', 'That handle is reserved.'],
  ])('rejects %s', (h, message) => {
    const r = handleSchema.safeParse(h);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain(message);
  });
});

describe('suggestHandle', () => {
  it('builds a valid handle from a name or email', () => {
    for (const input of [
      'Mara Quinn',
      'ada@example.com',
      'Ω',
      'Jo',
      'Admin',
      'a-very-long-display-name-indeed',
    ]) {
      const h = suggestHandle(input);
      expect(handleSchema.safeParse(h).success, `${input} → ${h}`).toBe(true);
    }
    expect(suggestHandle('Mara Quinn')).toBe('maraquinn');
  });
});

describe('parseTheme', () => {
  it('defaults to dark', () => {
    expect(parseTheme(undefined)).toBe('dark');
    expect(parseTheme('neon')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('system')).toBe('system');
  });
});
