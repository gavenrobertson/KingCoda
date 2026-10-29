// Copies Monaco's self-contained build into public/ so the editor loads from our own origin
// (no CDN). Versioned path: a Monaco upgrade never mixes cached files. Runs before dev and build.
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('monaco-editor/package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
const src = join(dirname(pkgPath), 'min', 'vs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'monaco');
const dest = join(root, version, 'vs');

if (!existsSync(dest)) {
  rmSync(root, { recursive: true, force: true });
  // The TypeScript worker (7 MB) only serves TS/JS editing, which the judge doesn't offer yet.
  cpSync(src, dest, { recursive: true, filter: (p) => !/ts\.worker-[^/]*\.js$/.test(p) });
  console.log(`monaco ${version} → public/monaco/${version}/vs`);
}
