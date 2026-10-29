// Turns content/build/<slug>/ into D1 statements and R2 uploads. Pure: the CLI runs them.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Problem } from '@kingcoda/problem-schema';

/** problem.json as `build` writes it. */
export interface BuiltJson extends Problem {
  statement: string;
  starterCode: Record<string, string>;
  referenceSolutions: Record<string, string>;
  counts: { sample: number; hidden: number };
}

export interface BuiltDir {
  json: BuiltJson;
  /** Raw file contents, for checksums and uploads. */
  files: { 'problem.json': string; 'sample.jsonl': string; 'hidden.jsonl': string };
  dir: string;
}

export function readBuilt(dir: string): BuiltDir {
  const read = (f: string) => readFileSync(join(dir, f), 'utf8');
  const files = {
    'problem.json': read('problem.json'),
    'sample.jsonl': read('sample.jsonl'),
    'hidden.jsonl': read('hidden.jsonl'),
  };
  return { json: JSON.parse(files['problem.json']) as BuiltJson, files, dir };
}

export function checksum(b: BuiltDir): string {
  const h = createHash('sha256');
  for (const f of ['problem.json', 'sample.jsonl', 'hidden.jsonl'] as const)
    h.update(f).update('\0').update(b.files[f]).update('\0');
  return h.digest('hex');
}

/** What the target database already holds for a problem. */
export interface Published {
  version: number;
  checksum: string;
}

export interface Upload {
  key: string;
  file: string;
}

export interface PublishPlan {
  sql: string;
  uploads: Upload[];
  changed: Array<{ slug: string; version: number }>;
  unchanged: string[];
}

export const problemId = (number: number) => `prb_${String(number).padStart(4, '0')}`;
export const testKey = (slug: string, version: number, kind: 'sample' | 'hidden') =>
  `tests/${slug}/v${version}/${kind}.jsonl`;

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const qj = (v: unknown) => q(JSON.stringify(v));

/** Plain-text body for full-text search: the statement without Markdown and maths markup. */
export function searchText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$?[^$]*\$\$?/g, ' ')
    .replace(/[`*_#>|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function planPublish(built: BuiltDir[], current: Map<string, Published>): PublishPlan {
  const stmts: string[] = [];
  const uploads: Upload[] = [];
  const changed: PublishPlan['changed'] = [];
  const unchanged: string[] = [];

  for (const b of built) {
    const p = b.json;
    const sum = checksum(b);
    const prev = current.get(p.slug);
    if (prev && prev.checksum === sum) {
      unchanged.push(p.slug);
      continue;
    }
    const version = prev ? prev.version + 1 : 1;
    const id = problemId(p.number);
    changed.push({ slug: p.slug, version });

    // Content and tests for the new version first; the problem row points at it last.
    const examples = p.examples.map((e) => ({
      input: e.args,
      output: e.output,
      ...(e.explanation ? { explanation: e.explanation } : {}),
    }));
    const hints = p.hints.map((h, i) => ({
      tier: i + 1,
      unlockAfterWrong: h.unlockAfterWrong,
      text: h.text,
    }));
    const constraintsMd = p.constraints.map((c) => `- ${c}`).join('\n');

    stmts.push(
      `INSERT INTO problem (id, number, slug, title, difficulty, difficulty_display, tags, status, version, license, source)
VALUES (${q(id)}, ${p.number}, ${q(p.slug)}, ${q(p.title)}, ${q(p.difficulty)}, ${q(p.difficulty)}, ${qj(p.tags)}, 'draft', ${version}, ${q(p.license)}, ${q(p.source)})
ON CONFLICT (id) DO NOTHING;`,
      `INSERT OR REPLACE INTO problem_content (problem_id, version, statement_md, constraints_md, examples, hints, signature, starter_code, limits, checker, editorial_md, reference_solutions)
VALUES (${q(id)}, ${version}, ${q(p.statement)}, ${q(constraintsMd)}, ${qj(examples)}, ${qj(hints)}, ${qj(p.signature)}, ${qj(p.starterCode)}, ${qj(p.limits)}, ${qj(p.checker)}, '', ${qj(p.referenceSolutions)});`,
    );
    for (const kind of ['sample', 'hidden'] as const) {
      const key = testKey(p.slug, version, kind);
      uploads.push({ key, file: join(b.dir, `${kind}.jsonl`) });
      stmts.push(
        `INSERT OR REPLACE INTO test_set (problem_id, version, kind, r2_key, count, checksum)
VALUES (${q(id)}, ${version}, ${q(kind)}, ${q(key)}, ${p.counts[kind]}, ${q(sum)});`,
      );
    }
    stmts.push(
      `UPDATE problem SET number = ${p.number}, slug = ${q(p.slug)}, title = ${q(p.title)}, difficulty = ${q(p.difficulty)},
  difficulty_display = ${q(p.difficulty)}, tags = ${qj(p.tags)}, status = 'published', version = ${version},
  license = ${q(p.license)}, source = ${q(p.source)}, updated_at = (unixepoch('subsec') * 1000)
WHERE id = ${q(id)};`,
      `DELETE FROM problem_tag WHERE problem_id = ${q(id)};`,
      ...p.tags.map((t) => `INSERT INTO problem_tag (problem_id, tag) VALUES (${q(id)}, ${q(t)});`),
      `DELETE FROM problem_fts WHERE rowid = ${p.number};`,
      `INSERT INTO problem_fts (rowid, title, tags, body) VALUES (${p.number}, ${q(p.title)}, ${q(p.tags.join(' '))}, ${q(searchText(p.statement))});`,
    );
  }
  return { sql: stmts.join('\n'), uploads, changed, unchanged };
}

/** SQL that reads back what `planPublish` needs to know about the target. */
export const CURRENT_SQL = `SELECT p.slug AS slug, p.version AS version, t.checksum AS checksum
FROM problem p JOIN test_set t ON t.problem_id = p.id AND t.version = p.version AND t.kind = 'hidden';`;
