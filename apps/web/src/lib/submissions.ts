import { z } from 'zod';
import { isJudged, parseCustomInput } from '@kingcoda/judge-core';
import type { Signature } from '@kingcoda/problem-schema';

/** Larger than any sensible solution; the box itself accepts up to 512 KiB. */
export const MAX_CODE_BYTES = 64 << 10;

export const submitBody = z
  .object({
    slug: z.string().min(1).max(80),
    lang: z.string().refine(isJudged, 'C++ is the only judged language for now'),
    mode: z.enum(['run', 'submit']),
    code: z.string().min(1, 'Write some code first'),
    customInput: z
      .string()
      .max(256 << 10)
      .optional(),
  })
  .strict();

export type SubmitBody = z.infer<typeof submitBody>;

export type Checked = { ok: true; body: SubmitBody } | { ok: false; error: string };

/** Validates a Run/Submit request against the problem's signature. Pure, so it is unit-tested. */
export function checkSubmission(raw: unknown, sig?: Signature): Checked {
  const parsed = submitBody.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Bad request' };
  const body = parsed.data;
  if (new TextEncoder().encode(body.code).length > MAX_CODE_BYTES)
    return { ok: false, error: 'Code is over 64 KiB' };
  if (body.mode === 'submit' && body.customInput !== undefined)
    return { ok: false, error: 'Custom input is for Run only' };
  if (sig && body.customInput !== undefined) {
    const custom = parseCustomInput(sig, body.customInput);
    if (!custom.ok) return { ok: false, error: custom.error };
  }
  return { ok: true, body };
}

/** Same-origin check for cookie-authenticated JSON endpoints. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function codeKey(id: string, at: Date): string {
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `subm/${at.getUTCFullYear()}/${mm}/${id}`;
}

/** What a submission's owner sees while it is judged and afterwards. */
export interface SubmissionView {
  id: string;
  mode: 'run' | 'submit';
  status: 'queued' | 'running' | 'done' | 'error';
  verdict: string | null;
  passed: number | null;
  total: number | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  report: Record<string, unknown> | null;
  compileLog: string | null;
  createdAt: number;
}
