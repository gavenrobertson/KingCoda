import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProgram, encodeInput, parseOutput } from '@kingcoda/harness';
import type { Signature } from '@kingcoda/problem-schema';

/** A compiled reference solution, run outside the sandbox (repo content is trusted). */
export class CompiledCpp {
  readonly dir: string;
  readonly bin: string;

  private constructor(dir: string, bin: string) {
    this.dir = dir;
    this.bin = bin;
  }

  static compile(sig: Signature, code: string): CompiledCpp {
    const dir = mkdtempSync(join(tmpdir(), 'kc-ref-'));
    for (const [name, content] of Object.entries(buildProgram(sig, 'cpp', code).files))
      writeFileSync(join(dir, name), content);
    const r = spawnSync(
      'g++',
      ['-O2', '-std=c++20', '-Werror=return-type', '-I.', '-o', 'main', 'main.cpp'],
      {
        cwd: dir,
        encoding: 'utf8',
      },
    );
    if (r.status !== 0) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`reference.cpp does not compile:\n${r.stderr}`);
    }
    return new CompiledCpp(dir, join(dir, 'main'));
  }

  /** Runs all cases in one process; returns outputs and wall time. */
  run(cases: Array<{ args: unknown[] }>): { outputs: unknown[]; ms: number } {
    const t0 = performance.now();
    const r = spawnSync(this.bin, [], {
      input: encodeInput(cases),
      encoding: 'utf8',
      maxBuffer: 512 << 20,
    });
    const ms = performance.now() - t0;
    const parsed = parseOutput(r.stdout);
    if (r.status !== 0 || parsed.results.length !== cases.length) {
      throw new Error(
        `reference failed after ${parsed.results.length}/${cases.length} cases (exit ${r.status}): ${r.stderr.slice(0, 500)}`,
      );
    }
    return { outputs: parsed.results, ms };
  }

  dispose() {
    rmSync(this.dir, { recursive: true, force: true });
  }
}
