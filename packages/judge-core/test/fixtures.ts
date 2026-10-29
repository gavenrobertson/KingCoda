import type { Signature } from '@kingcoda/problem-schema';
import type { BoxStep } from '../src/index.ts';

export const SIG: Signature = {
  function: 'addUp',
  params: [
    { name: 'xs', type: 'int[]' },
    { name: 'k', type: 'int' },
  ],
  returns: 'long',
};

export const rec = (v: unknown) => `\x1e${JSON.stringify(v)}\n`;

export function step(over: Partial<BoxStep> = {}): BoxStep {
  return {
    status: 'ok',
    stdout: '',
    stderr: '',
    exitCode: 0,
    cpuMs: 5,
    wallMs: 6,
    maxRssKb: 3000,
    ...over,
  };
}
