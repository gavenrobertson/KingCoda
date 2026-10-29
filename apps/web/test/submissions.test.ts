import { describe, expect, it, vi } from 'vitest';
import type { Signature } from '@kingcoda/problem-schema';
import { checkSubmission, codeKey, sameOrigin } from '../src/lib/submissions';

vi.mock('server-only', () => ({}));
const { ftsQuery, parseFilters, filtersToParams } = await import('../src/lib/problems');

const SIG: Signature = { function: 'f', params: [{ name: 'xs', type: 'int[]' }], returns: 'int' };
const ok = { slug: 'twin-coins', lang: 'cpp', mode: 'run', code: 'class Solution {};' };

describe('checkSubmission', () => {
  it('accepts a C++ run with valid custom input', () => {
    expect(checkSubmission({ ...ok, customInput: '[1,2]\n' }, SIG)).toMatchObject({ ok: true });
  });

  it('rejects other languages, empty or huge code, unknown fields', () => {
    expect(checkSubmission({ ...ok, lang: 'python' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('C++'),
    });
    expect(checkSubmission({ ...ok, code: '' })).toMatchObject({
      ok: false,
      error: 'Write some code first',
    });
    expect(checkSubmission({ ...ok, code: 'x'.repeat(65 << 10) })).toMatchObject({
      ok: false,
      error: 'Code is over 64 KiB',
    });
    expect(checkSubmission({ ...ok, userId: 'someone-else' })).toMatchObject({ ok: false });
    expect(checkSubmission(null)).toMatchObject({ ok: false });
  });

  it('keeps custom input to Run and checks it against the signature', () => {
    expect(checkSubmission({ ...ok, mode: 'submit', customInput: '[1]' })).toMatchObject({
      ok: false,
    });
    expect(checkSubmission({ ...ok, customInput: '"nope"' }, SIG)).toMatchObject({
      ok: false,
      error: 'Test 1, xs: expected int[]',
    });
  });
});

describe('sameOrigin', () => {
  const req = (origin?: string) =>
    new Request('https://kingcoda.example/api/submissions', {
      method: 'POST',
      headers: origin ? { origin } : {},
    });
  it('requires the request to come from this site', () => {
    expect(sameOrigin(req('https://kingcoda.example'))).toBe(true);
    expect(sameOrigin(req('https://evil.example'))).toBe(false);
    expect(sameOrigin(req())).toBe(false);
  });
});

describe('codeKey', () => {
  it('partitions by month', () => {
    expect(codeKey('01ABC', new Date(Date.UTC(2026, 9, 29)))).toBe('subm/2026/10/01ABC');
  });
});

describe('problem list filters', () => {
  it('quotes every search word so FTS operators in input are inert', () => {
    expect(ftsQuery('Twin coins')).toBe('"twin"* "coins"*');
    expect(ftsQuery('a" OR NEAR(b) -c*')).toBe('"a"* "or"* "near"* "b"* "c"*');
    expect(ftsQuery('!!!')).toBeNull();
  });

  it('drops unknown filter values and round-trips the rest', () => {
    const f = parseFilters({
      q: 'coin',
      difficulty: 'Easy',
      status: 'solved',
      tag: 'Arrays',
      junk: 'x',
    });
    expect(f).toEqual({ q: 'coin', difficulty: 'Easy', tag: 'Arrays', status: 'solved' });
    expect(parseFilters({ difficulty: 'Impossible', status: 'hacked' })).toEqual({
      q: undefined,
      difficulty: undefined,
      tag: undefined,
      status: undefined,
    });
    expect(filtersToParams(f).toString()).toBe('q=coin&difficulty=Easy&tag=Arrays&status=solved');
  });
});
