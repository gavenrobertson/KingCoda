import { fileURLToPath } from 'node:url';

export const PRELUDE_PATH = fileURLToPath(
  new URL('../../../judge/include/kc_prelude.hpp', import.meta.url),
);
