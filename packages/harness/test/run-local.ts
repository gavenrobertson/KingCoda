// Runs a harness Program with local toolchains, mirroring the judge box's commands (no sandbox:
// test code only). The judge box itself is exercised by judge-spike/probes.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Language } from '@kingcoda/problem-schema';
import type { Program } from '../src/index.ts';

export interface LocalRun {
  stdout: string;
  stderr: string;
  status: number | null;
  compileError?: string;
}

export function runLocal(lang: Language, program: Program, stdin: string): LocalRun {
  const dir = mkdtempSync(join(tmpdir(), 'kc-harness-'));
  try {
    for (const [name, content] of Object.entries(program.files))
      writeFileSync(join(dir, name), content);
    let cmd: [string, string[]];
    if (lang === 'python') cmd = ['python3', ['-S', '-B', 'driver.py']];
    else if (lang === 'javascript') cmd = ['node', ['main.js']];
    else {
      const c = spawnSync('g++', ['-O2', '-std=c++20', '-I.', '-o', 'main', 'main.cpp'], {
        cwd: dir,
        encoding: 'utf8',
      });
      if (c.status !== 0)
        return { stdout: '', stderr: c.stderr, status: c.status, compileError: c.stderr };
      cmd = ['./main', []];
    }
    const r = spawnSync(cmd[0], cmd[1], {
      cwd: dir,
      input: stdin,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function haveToolchains(): boolean {
  try {
    execFileSync('python3', ['--version']);
    execFileSync('g++', ['--version']);
    return true;
  } catch {
    return false;
  }
}
