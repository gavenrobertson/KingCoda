import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT } from './load.ts';

const RUNNER = join(REPO_ROOT, 'tools', 'pipeline', 'py', 'gen_runner.py');

function run(args: string[], input?: string): unknown {
  const out = execFileSync('python3', ['-I', RUNNER, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 512 << 20,
  });
  return JSON.parse(out);
}

export type Args = Record<string, unknown>;

export const edgeCases = (dir: string) =>
  run(['edges', dir]) as Array<{ category: string; args: Args }>;
export const randomCases = (
  dir: string,
  size: 'small' | 'medium' | 'max',
  seed: number,
  count: number,
) => run(['random', dir, size, String(seed), String(count)]) as Args[];
export const bruteOutputs = (dir: string, cases: Args[]) =>
  run(['brute', dir], JSON.stringify(cases)) as unknown[];
