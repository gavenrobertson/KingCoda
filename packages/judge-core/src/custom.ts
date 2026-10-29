import { conforms, type Signature } from '@kingcoda/problem-schema';

export const CUSTOM_MAX_CASES = 10;
export const CUSTOM_MAX_BYTES = 256 << 10;

export type CustomInput = { ok: true; cases: unknown[][] } | { ok: false; error: string };

/**
 * Custom input for Run: one JSON value per line, one line per parameter, cases back to back
 * (blank lines ignored). Values must have the parameter's type; problem constraints aren't checked,
 * so the reference may reject inputs outside them.
 */
export function parseCustomInput(sig: Signature, text: string): CustomInput {
  if (text.length > CUSTOM_MAX_BYTES) return { ok: false, error: 'Custom input is over 256 KiB' };
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const n = sig.params.length;
  if (lines.length === 0) return { ok: false, error: 'Custom input is empty' };
  if (lines.length % n !== 0)
    return {
      ok: false,
      error: `Expected ${n} line${n === 1 ? '' : 's'} per test (${sig.params.map((p) => p.name).join(', ')}), got ${lines.length}`,
    };
  if (lines.length / n > CUSTOM_MAX_CASES)
    return { ok: false, error: `At most ${CUSTOM_MAX_CASES} custom tests per run` };

  const cases: unknown[][] = [];
  for (let i = 0; i < lines.length; i += n) {
    const args: unknown[] = [];
    for (const [j, p] of sig.params.entries()) {
      const line = lines[i + j]!;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        return { ok: false, error: `Test ${i / n + 1}, ${p.name}: not valid JSON` };
      }
      if (!conforms(value, p.type))
        return { ok: false, error: `Test ${i / n + 1}, ${p.name}: expected ${p.type}` };
      args.push(value);
    }
    cases.push(args);
  }
  return { ok: true, cases };
}

/** The examples as custom-input text, to prefill the editor's input box. */
export function formatCustomInput(cases: unknown[][]): string {
  return cases.map((args) => args.map((a) => JSON.stringify(a)).join('\n')).join('\n\n') + '\n';
}
