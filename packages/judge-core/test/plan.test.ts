import { describe, expect, it } from 'vitest';
import { buildJob, groupCases, JobTooLarge, LARGEST_CATEGORY } from '../src/index.ts';
import { SIG } from './fixtures.ts';

const big = { category: LARGEST_CATEGORY };

describe('groupCases', () => {
  it('batches small cases and isolates each largest input', () => {
    expect(groupCases([{}, {}, { category: 'negatives' }, big, big, {}])).toEqual([
      { start: 0, count: 3 },
      { start: 3, count: 1 },
      { start: 4, count: 1 },
      { start: 5, count: 1 },
    ]);
    expect(groupCases([])).toEqual([]);
  });
});

describe('buildJob', () => {
  const cases = [
    { args: [[1, 2], 3], expected: 6 },
    { args: [[5], 1], expected: 5 },
    { args: [[9, 9, 9], 2], expected: 27, ...big },
  ];
  const base = {
    id: 'sub_1',
    signature: SIG,
    lang: 'cpp' as const,
    code: 'class Solution {};',
    cases,
    limits: { timeMs: 1000, memoryMb: 256 },
  };

  it('submits in groups and stops at the first failing process', () => {
    const { job, groups } = buildJob({ ...base, mode: 'submit' });
    expect(groups).toHaveLength(2);
    expect(job.inputs).toEqual(['[[1,2],3]\n[[5],1]\n', '[[9,9,9],2]\n']);
    expect(job.stopOnFailure).toBe(true);
    expect(job.timeMs).toBe(1000);
    expect(job.lang).toBe('cpp');
  });

  it('runs every case in one process for Run', () => {
    const { job, groups } = buildJob({ ...base, mode: 'run' });
    expect(groups).toEqual([{ start: 0, count: 3 }]);
    expect(job.inputs).toHaveLength(1);
    expect(job.stopOnFailure).toBe(false);
  });

  it('never sends expected outputs to the box', () => {
    const { job } = buildJob({
      ...base,
      cases: [{ args: [[1], 1], expected: 'SECRET-77' }],
      mode: 'submit',
    });
    expect(JSON.stringify(job)).not.toContain('SECRET-77');
  });

  it('uses the prelude baked into the image for C++', () => {
    const { job } = buildJob({ ...base, mode: 'submit' });
    expect(Object.keys(job.files)).toEqual(['main.cpp']);
    expect(job.files['main.cpp']).toContain('#include <kc_prelude.hpp>');
    expect(job.files['main.cpp']).toContain('class Solution {};');
  });

  it('scales the time limit by language and maps the box language', () => {
    const { job } = buildJob({
      ...base,
      lang: 'python',
      code: 'class Solution: pass',
      mode: 'submit',
    });
    expect(job.timeMs).toBe(4000);
    expect(job.lang).toBe('python-harness');
    expect(Object.keys(job.files).sort()).toEqual(['driver.py', 'solution.py']);
  });

  it('sizes the output limit from the expected output', () => {
    expect(buildJob({ ...base, mode: 'submit' }).job.outputLimit).toBeLessThan((256 << 10) + 100);
    const long = Array.from({ length: 200_000 }, (_, i) => i);
    const { job } = buildJob({
      ...base,
      cases: [{ args: [[1], 1], expected: long }],
      mode: 'submit',
    });
    expect(job.outputLimit).toBeGreaterThan(2 * JSON.stringify(long).length);
    expect(job.outputLimit).toBeLessThanOrEqual(16 << 20);
  });

  it('rejects suites the box would refuse', () => {
    const many = Array.from({ length: 501 }, () => ({ args: [[1], 1], expected: 1, ...big }));
    expect(() => buildJob({ ...base, cases: many, mode: 'submit' })).toThrow(JobTooLarge);
  });
});
