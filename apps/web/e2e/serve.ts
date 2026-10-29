// Playwright's web server: a fresh local stack for every run.
//   1. throwaway D1/R2 state, migrated, with two problems built and published into it
//   2. the judge Worker (wrangler dev, e2e env), which sends jobs to the Docker judge box on :18080
//   3. the web app (next dev, e2e env)
// The judge box itself runs in Docker beforehand (judge/README.md; CI starts it).
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';

const PORT = process.env.PORT ?? '3100';
const PROBLEMS = ['twin-coins', 'castle-gate-intervals'];
const env = { ...process.env, CI: '1' };

rmSync('.wrangler/e2e-state', { recursive: true, force: true });
const pipeline = (...args: string[]) =>
  execFileSync('node', ['../../tools/pipeline/src/cli.ts', ...args], { stdio: 'inherit', env });
pipeline('build', ...PROBLEMS);
// publish applies the migrations first.
pipeline('publish', 'e2e', ...PROBLEMS);
execFileSync('node', ['scripts/copy-monaco.ts'], { stdio: 'inherit' });

const children: ChildProcess[] = [];
children.push(
  spawn(
    'pnpm',
    [
      '--filter',
      '@kingcoda/judge',
      'exec',
      'wrangler',
      'dev',
      '--env',
      'e2e',
      '--port',
      '8788',
      '--persist-to',
      '../web/.wrangler/e2e-state',
    ],
    { stdio: 'inherit', env },
  ),
);
// The web app binds the judge through the local dev registry when it starts, so the judge has to
// be up first; otherwise the binding resolves to a stub and nothing gets judged.
for (let i = 0; ; i++) {
  try {
    if ((await fetch('http://localhost:8788/')).ok) break;
  } catch {
    // not up yet
  }
  if (i > 120) throw new Error('judge Worker did not start');
  await new Promise((r) => setTimeout(r, 500));
}
children.push(
  spawn('pnpm', ['exec', 'next', 'dev', '--port', PORT], {
    stdio: 'inherit',
    env: { ...env, KC_E2E: '1', NEXT_TELEMETRY_DISABLED: '1' },
  }),
);

const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
for (const c of children) c.on('exit', (code) => code && process.exit(code));
