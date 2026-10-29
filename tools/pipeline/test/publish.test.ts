import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checksum,
  planPublish,
  problemId,
  readBuilt,
  searchText,
  testKey,
  type BuiltJson,
} from '../src/publish.ts';
import { readdirSync, readFileSync } from 'node:fs';

const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);
const tmp = mkdtempSync(join(tmpdir(), 'kc-pub-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fixture(overrides: Partial<BuiltJson> = {}, hidden = '{"args":[[1]],"expected":1}\n') {
  const json: BuiltJson = {
    number: 7,
    slug: 'sample-sum',
    title: "Knight's Sum",
    difficulty: 'Easy',
    tags: ['Arrays', 'Math'],
    signature: { function: 'sumAll', params: [{ name: 'xs', type: 'int[]' }], returns: 'long' },
    limits: { timeMs: 1000, memoryMb: 256 },
    checker: { kind: 'exact' },
    constraints: ['1 ≤ xs.length ≤ 10⁵'],
    examples: [{ args: { xs: [1, 2] }, output: 3, explanation: 'One plus two.' }],
    hints: [{ text: 'Add them all up, one by one.', unlockAfterWrong: 1 }],
    license: 'CC-BY-SA-4.0',
    source: 'Original KingCoda problem',
    tests: { random: 40, max: 3 },
    statement: 'Sum the **numbers** in `xs`. $x_i$ can be negative.',
    starterCode: { cpp: 'class Solution {};' },
    referenceSolutions: { cpp: "class Solution { /* it's fine */ };" },
    counts: { sample: 1, hidden: 1 },
    ...overrides,
  };
  const dir = mkdtempSync(join(tmp, 'b-'));
  writeFileSync(join(dir, 'problem.json'), JSON.stringify(json));
  writeFileSync(join(dir, 'sample.jsonl'), '{"args":[[1,2]],"expected":3}\n');
  writeFileSync(join(dir, 'hidden.jsonl'), hidden);
  return readBuilt(dir);
}

function migratedDb() {
  const db = new Database(':memory:');
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files)
    db.exec(
      readFileSync(new URL(f, MIGRATIONS), 'utf8').replaceAll('--> statement-breakpoint', ''),
    );
  return db;
}

describe('planPublish', () => {
  it('publishes a new problem as version 1 and makes it searchable', () => {
    const b = fixture();
    const plan = planPublish([b], new Map());
    expect(plan.changed).toEqual([{ slug: 'sample-sum', version: 1 }]);
    expect(plan.uploads.map((u) => u.key)).toEqual([
      testKey('sample-sum', 1, 'sample'),
      testKey('sample-sum', 1, 'hidden'),
    ]);

    const db = migratedDb();
    db.exec(plan.sql);
    const row = db.prepare('SELECT * FROM problem').get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: problemId(7),
      title: "Knight's Sum",
      status: 'published',
      version: 1,
    });
    const content = db.prepare('SELECT * FROM problem_content').get() as Record<string, string>;
    expect(JSON.parse(content.examples!)).toEqual([
      { input: { xs: [1, 2] }, output: 3, explanation: 'One plus two.' },
    ]);
    expect(JSON.parse(content.hints!)).toEqual([
      { tier: 1, unlockAfterWrong: 1, text: 'Add them all up, one by one.' },
    ]);
    expect(JSON.parse(content.reference_solutions!).cpp).toContain("it's fine");
    expect(db.prepare('SELECT tag FROM problem_tag ORDER BY tag').all()).toEqual([
      { tag: 'Arrays' },
      { tag: 'Math' },
    ]);
    expect(
      db.prepare("SELECT kind, count, checksum FROM test_set WHERE kind = 'hidden'").get(),
    ).toEqual({
      kind: 'hidden',
      count: 1,
      checksum: checksum(b),
    });
    expect(
      db.prepare("SELECT rowid FROM problem_fts WHERE problem_fts MATCH 'negative'").all(),
    ).toEqual([{ rowid: 7 }]);
  });

  it('skips unchanged problems and versions changed ones', () => {
    const b = fixture();
    const db = migratedDb();
    db.exec(planPublish([b], new Map()).sql);
    const current = new Map([['sample-sum', { version: 1, checksum: checksum(b) }]]);
    expect(planPublish([b], current)).toMatchObject({
      sql: '',
      uploads: [],
      unchanged: ['sample-sum'],
    });

    const edited = fixture({ title: 'Knight Sum' }, '{"args":[[2]],"expected":2}\n');
    const plan = planPublish([edited], current);
    expect(plan.changed).toEqual([{ slug: 'sample-sum', version: 2 }]);
    db.exec(plan.sql);
    expect(db.prepare('SELECT version, title FROM problem').get()).toEqual({
      version: 2,
      title: 'Knight Sum',
    });
    // Old versions stay for submissions judged against them.
    expect(db.prepare('SELECT count(*) AS n FROM problem_content').get()).toEqual({ n: 2 });
    expect(db.prepare('SELECT count(*) AS n FROM problem_fts').get()).toEqual({ n: 1 });
  });
});

describe('searchText', () => {
  it('strips Markdown and maths', () => {
    expect(
      searchText('# Title\n\nSum **all** `xs`, where $x_i \\le 10$.\n\n```cpp\nint x;\n```'),
    ).toBe('Title Sum all xs , where .');
  });
});
