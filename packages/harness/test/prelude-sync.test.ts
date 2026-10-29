import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CPP_PRELUDE } from '../src/index.ts';
import { PRELUDE_PATH } from '../scripts/prelude-path.ts';

it('judge image prelude matches the harness (run `pnpm --filter @kingcoda/harness write:prelude`)', () => {
  expect(readFileSync(PRELUDE_PATH, 'utf8')).toBe(CPP_PRELUDE);
});
