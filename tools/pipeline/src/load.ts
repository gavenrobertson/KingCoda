import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { problemSchema, type Problem } from '@kingcoda/problem-schema';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const PROBLEMS_DIR = join(REPO_ROOT, 'content', 'problems');
export const BUILD_DIR = join(REPO_ROOT, 'content', 'build');

export interface Package {
  dir: string;
  meta: Problem;
  statement: string;
  reference: string;
}

export class PackageError extends Error {}

/** Reads and schema-checks one problem package. Throws PackageError with a readable message. */
export function loadPackage(dir: string): Package {
  const need = [
    'problem.yaml',
    'statement.md',
    'gen.py',
    'solutions/reference.cpp',
    'solutions/brute.py',
  ];
  const missing = need.filter((f) => !existsSync(join(dir, f)));
  if (missing.length) throw new PackageError(`missing ${missing.join(', ')}`);

  const parsed = problemSchema.safeParse(
    parseYaml(readFileSync(join(dir, 'problem.yaml'), 'utf8')),
  );
  if (!parsed.success) {
    throw new PackageError(
      parsed.error.issues.map((i) => `problem.yaml ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  }
  const statement = readFileSync(join(dir, 'statement.md'), 'utf8').trim();
  if (statement.length < 80) throw new PackageError('statement.md is too short');
  return {
    dir,
    meta: parsed.data,
    statement,
    reference: readFileSync(join(dir, 'solutions/reference.cpp'), 'utf8'),
  };
}

export function packageDirs(slugs?: string[]): string[] {
  const all = readdirSync(PROBLEMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const pick = slugs?.length ? all.filter((s) => slugs.includes(s)) : all;
  return pick.map((s) => join(PROBLEMS_DIR, s));
}
