import { contrastReport } from '../src/contrast-report.ts';

const rows = contrastReport();
for (const r of rows) {
  const mark = r.pass ? 'ok  ' : 'FAIL';
  console.log(
    `${mark} ${r.theme.padEnd(5)} ${r.fg.padEnd(16)} on ${r.bg.padEnd(24)} ${r.ratio.toFixed(2)} (min ${r.min})`,
  );
}
const failed = rows.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} contrast pair(s) below WCAG AA.`);
  process.exit(1);
}
console.log(`\nAll ${rows.length} pairs pass.`);
