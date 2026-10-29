import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PROBLEMS_DIR } from '../src/load.ts';
import { validatePackage } from '../src/validate.ts';

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Copies a real package somewhere disposable so a test can break it. */
function copyOf(slug: string): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'kc-pkg-')), slug);
  cpSync(join(PROBLEMS_DIR, slug), dir, { recursive: true });
  scratch.push(dir);
  return dir;
}

describe('validatePackage', () => {
  it('passes a real package and builds its suites', () => {
    const { checks, built } = validatePackage(join(PROBLEMS_DIR, 'messenger-bits'));
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(built?.samples).toHaveLength(2);
    expect(built!.hidden.length).toBeGreaterThanOrEqual(40);
    expect(built!.hidden[0]).toMatchObject({ category: 'zero', expected: [0] });
  });

  it('catches a wrong example', () => {
    const dir = copyOf('messenger-bits');
    const yaml = join(dir, 'problem.yaml');
    writeFileSync(
      yaml,
      readFileSync(yaml, 'utf8').replace(
        'output: [0, 1, 1, 2, 1, 2]',
        'output: [0, 1, 1, 2, 1, 3]',
      ),
    );
    const { checks } = validatePackage(dir);
    expect(checks.at(-1)).toMatchObject({ name: 'reference passes examples', ok: false });
  });

  it('catches a reference that disagrees with brute force', () => {
    const dir = copyOf('messenger-bits');
    const ref = join(dir, 'solutions/reference.cpp');
    // Off by one for every multiple of 7: examples still pass, random inputs don't.
    writeFileSync(
      ref,
      readFileSync(ref, 'utf8').replace(
        'lit[i] = lit[i >> 1] + (i & 1);',
        'lit[i] = lit[i >> 1] + (i & 1) + (i == 7);',
      ),
    );
    const { checks } = validatePackage(dir);
    expect(checks.at(-1)).toMatchObject({ name: 'brute force agrees', ok: false });
  });

  it('catches a reference that does not compile', () => {
    const dir = copyOf('messenger-bits');
    writeFileSync(join(dir, 'solutions/reference.cpp'), 'class Solution { oops };');
    const { checks } = validatePackage(dir);
    expect(checks.at(-1)).toMatchObject({ name: 'reference compiles', ok: false });
  });

  it('catches a missing file', () => {
    const dir = copyOf('messenger-bits');
    rmSync(join(dir, 'gen.py'));
    const { checks } = validatePackage(dir);
    expect(checks[0]).toMatchObject({ name: 'package', ok: false });
    expect(checks[0]!.detail).toContain('gen.py');
  });
});
