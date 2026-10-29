// Runs before the Playwright web server starts: a fresh local D1, migrated from packages/db/migrations.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('.wrangler/e2e-state', { recursive: true, force: true });
execFileSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--env',
    'e2e',
    '--persist-to',
    '.wrangler/e2e-state',
  ],
  { stdio: 'inherit', env: { ...process.env, CI: '1' } },
);
