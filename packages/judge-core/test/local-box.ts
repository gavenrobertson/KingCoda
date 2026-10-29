// A stand-in for the judge box that runs C++ jobs with the local g++ and no sandbox: test code only.
// It mirrors kc-run's wire format so judge-core can be tested end to end; the real box is
// exercised by judge/probes.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BoxJob, BoxResult, BoxStep } from '../src/index.ts';

const INCLUDE = fileURLToPath(new URL('../../../judge/include', import.meta.url));

export function haveGpp(): boolean {
  try {
    execFileSync('g++', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const blank: BoxStep = {
  status: 'ok',
  stdout: '',
  stderr: '',
  exitCode: 0,
  cpuMs: 0,
  wallMs: 0,
  maxRssKb: 0,
};

export function runLocalBox(job: BoxJob): BoxResult {
  const dir = mkdtempSync(join(tmpdir(), 'kc-box-'));
  try {
    for (const [name, content] of Object.entries(job.files))
      writeFileSync(join(dir, name), content);
    const cc = spawnSync(
      'g++',
      ['-O2', '-std=c++20', '-pipe', `-I${INCLUDE}`, '-o', 'main', 'main.cpp'],
      {
        cwd: dir,
        encoding: 'utf8',
      },
    );
    if (cc.status !== 0)
      return {
        id: job.id,
        compile: { ...blank, status: 'ce', stderr: cc.stderr },
        tests: [],
        strays: 0,
      };

    const tests: BoxStep[] = [];
    for (const input of job.inputs) {
      const t0 = performance.now();
      const r = spawnSync(join(dir, 'main'), [], {
        cwd: dir,
        input,
        encoding: 'utf8',
        timeout: job.timeMs,
        maxBuffer: job.outputLimit,
      });
      const ms = Math.round(performance.now() - t0);
      const s: BoxStep = {
        ...blank,
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
        exitCode: r.status ?? -1,
        cpuMs: ms,
        wallMs: ms,
      };
      const err = r.error as (Error & { code?: string }) | undefined;
      if (err?.code === 'ETIMEDOUT') s.status = 'tle';
      else if (err?.code === 'ENOBUFS') s.status = 'ole';
      else if (r.signal) Object.assign(s, { status: 're', signal: r.signal });
      else if (r.status !== 0) s.status = 're';
      tests.push(s);
      if (job.stopOnFailure && s.status !== 'ok') break;
    }
    return { id: job.id, compile: { ...blank }, tests, strays: 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
