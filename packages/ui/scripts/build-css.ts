import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildThemeCss } from '../src/css.ts';

const out = fileURLToPath(new URL('../styles/theme.css', import.meta.url));
writeFileSync(out, buildThemeCss());
console.log(`wrote ${out}`);
