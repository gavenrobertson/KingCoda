// Runs a publish plan against a wrangler environment of apps/judge, which binds D1 and the tests bucket.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILD_DIR, REPO_ROOT } from './load.ts';
import { CURRENT_SQL, planPublish, readBuilt, type Published } from './publish.ts';

const JUDGE_DIR = join(REPO_ROOT, 'apps', 'judge');

const TARGETS = {
  // Local targets share the web app's emulated state (apps/web/.wrangler).
  local: {
    flags: ['--local', '--persist-to', '../web/.wrangler/state'],
    bucket: 'kingcoda-tests-local',
  },
  e2e: {
    flags: ['--env', 'e2e', '--local', '--persist-to', '../web/.wrangler/e2e-state'],
    bucket: 'kingcoda-tests-e2e',
  },
  production: { flags: ['--env', 'production', '--remote'], bucket: 'kingcoda-tests' },
} as const;

function wrangler(args: string[]): string {
  const r = spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd: JUDGE_DIR,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
  if (r.status !== 0)
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

export async function publish(env: string | undefined, only: string[]): Promise<number> {
  if (!env || !(env in TARGETS)) {
    console.error('usage: kc-pipeline publish <local|e2e|production> [slug...]');
    return 2;
  }
  const target = TARGETS[env as keyof typeof TARGETS];
  if (!existsSync(BUILD_DIR)) {
    console.error('content/build is empty: run `kc-pipeline build` first');
    return 1;
  }
  const dirs = readdirSync(BUILD_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!only.length || only.includes(d.name)))
    .map((d) => join(BUILD_DIR, d.name));
  const built = dirs.map(readBuilt);

  if (env !== 'production') wrangler(['d1', 'migrations', 'apply', 'DB', ...target.flags]);
  const rows = JSON.parse(
    wrangler(['d1', 'execute', 'DB', '--json', '--command', CURRENT_SQL, ...target.flags]),
  ) as Array<{
    results: Array<{ slug: string } & Published>;
  }>;
  const current = new Map(
    rows[0]!.results.map((r) => [r.slug, { version: r.version, checksum: r.checksum }]),
  );
  const plan = planPublish(built, current);

  for (const u of plan.uploads) {
    wrangler([
      'r2',
      'object',
      'put',
      `${target.bucket}/${u.key}`,
      '--file',
      u.file,
      '--content-type',
      'application/x-ndjson',
      ...target.flags,
    ]);
  }
  if (plan.sql) {
    const tmp = mkdtempSync(join(tmpdir(), 'kc-publish-'));
    try {
      const file = join(tmp, 'publish.sql');
      writeFileSync(file, plan.sql);
      wrangler([
        'd1',
        'execute',
        'DB',
        '--file',
        file,
        ...(env === 'production' ? ['--yes'] : []),
        ...target.flags,
      ]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  for (const c of plan.changed) console.log(`published ${c.slug} v${c.version}`);
  if (plan.unchanged.length) console.log(`unchanged: ${plan.unchanged.length} problem(s)`);
  return 0;
}
