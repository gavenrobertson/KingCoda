#!/usr/bin/env node
// kc-pipeline validate [slug...]   check packages (fails on the first broken check per package)
// kc-pipeline build [slug...]      validate, then write content/build/<slug>/ for publishing
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '@kingcoda/problem-schema';
import { starterCode } from '@kingcoda/harness';
import { BUILD_DIR, packageDirs } from './load.ts';
import { validatePackage, type BuiltProblem } from './validate.ts';

const [command, ...slugs] = process.argv.slice(2);
if (command !== 'validate' && command !== 'build') {
  console.error('usage: kc-pipeline validate|build [slug...]');
  process.exit(2);
}

function writeBuild(b: BuiltProblem) {
  const { meta, statement } = b.pkg;
  const out = join(BUILD_DIR, meta.slug);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const jsonl = (cases: BuiltProblem['hidden']) => cases.map((c) => canonical(c)).join('\n') + '\n';
  writeFileSync(join(out, 'sample.jsonl'), jsonl(b.samples));
  writeFileSync(join(out, 'hidden.jsonl'), jsonl(b.hidden));
  writeFileSync(
    join(out, 'problem.json'),
    JSON.stringify(
      {
        ...meta,
        statement,
        starterCode: { cpp: starterCode(meta.signature, 'cpp') },
        counts: { sample: b.samples.length, hidden: b.hidden.length },
      },
      null,
      2,
    ),
  );
}

const dirs = packageDirs(slugs);
if (!dirs.length) {
  console.error('no matching packages under content/problems');
  process.exit(1);
}

const seen = {
  number: new Map<number, string>(),
  slug: new Map<string, string>(),
  title: new Map<string, string>(),
};
let failed = 0;
for (const dir of dirs) {
  const name = dir.split('/').pop()!;
  const { checks, built } = validatePackage(dir);
  const bad = checks.filter((c) => !c.ok);
  if (built) {
    const m = built.pkg.meta;
    if (m.slug !== name)
      bad.push({
        name: 'folder matches slug',
        ok: false,
        detail: `folder ${name}, slug ${m.slug}`,
      });
    for (const [key, val] of [
      ['number', m.number],
      ['slug', m.slug],
      ['title', m.title.toLowerCase()],
    ] as const) {
      const map = seen[key] as Map<unknown, string>;
      if (map.has(val))
        bad.push({
          name: `unique ${key}`,
          ok: false,
          detail: `${val} also used by ${map.get(val)}`,
        });
      map.set(val, name);
    }
  }
  if (bad.length) {
    failed++;
    console.log(`✗ ${name}`);
    for (const c of bad) console.log(`    ${c.name}: ${c.detail}`);
    continue;
  }
  console.log(
    `✓ ${name}  (${checks
      .map((c) => c.detail)
      .filter(Boolean)
      .join(' · ')})`,
  );
  if (command === 'build' && built) writeBuild(built);
}

console.log(`\n${dirs.length - failed}/${dirs.length} packages valid`);
process.exit(failed ? 1 : 0);
