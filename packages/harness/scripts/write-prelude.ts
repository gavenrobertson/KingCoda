// Writes the C++ prelude into the judge image's build context, where the Dockerfile precompiles it.
// A harness test fails if judge/include/kc_prelude.hpp drifts from CPP_PRELUDE.
import { writeFileSync } from 'node:fs';
import { CPP_PRELUDE } from '../src/cpp-prelude.ts';
import { PRELUDE_PATH } from './prelude-path.ts';

writeFileSync(PRELUDE_PATH, CPP_PRELUDE);
console.log(`wrote ${PRELUDE_PATH}`);
