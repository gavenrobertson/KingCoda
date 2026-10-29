import { buildProgram, encodeInput } from '@kingcoda/harness';
import {
  canonical,
  TIME_MULTIPLIER,
  type Language,
  type Signature,
} from '@kingcoda/problem-schema';
import { BOX_LIMITS, type BoxJob, type BoxLang } from './box.ts';

/** Languages the judge accepts. Python and JavaScript drivers exist and switch on in Phase 3. */
export const JUDGED_LANGUAGES = ['cpp'] as const satisfies readonly Language[];

export function isJudged(lang: string): lang is (typeof JUDGED_LANGUAGES)[number] {
  return (JUDGED_LANGUAGES as readonly string[]).includes(lang);
}

/** The pipeline's label for its largest generated inputs; each runs in a process of its own. */
export const LARGEST_CATEGORY = 'largest inputs';

export interface JudgeCase {
  args: unknown[];
  /** Absent for custom input, whose expected output comes from a separate reference run. */
  expected?: unknown;
  category?: string;
}

/** A run of consecutive cases in one process: cases[start, start + count). */
export interface Group {
  start: number;
  count: number;
  /**
   * Every case in it is public (examples, custom input), so its output, printing and stderr may be
   * shown. Public and hidden cases never share a process: code that reads all of stdin could
   * otherwise print hidden inputs while failing a public case.
   */
  public: boolean;
}

/**
 * Every process gets the full time limit. Small cases share one process; each largest-input case
 * gets its own, so the limit is a per-test complexity gate rather than a budget for the whole suite.
 */
export function groupCases(
  cases: ReadonlyArray<{ category?: string }>,
  offset = 0,
  isPublic = false,
): Group[] {
  const groups: Group[] = [];
  let open: Group | null = null;
  for (const [i, c] of cases.entries()) {
    if (c.category === LARGEST_CATEGORY) {
      open = null;
      groups.push({ start: offset + i, count: 1, public: isPublic });
    } else if (open) {
      open.count++;
    } else {
      open = { start: offset + i, count: 1, public: isPublic };
      groups.push(open);
    }
  }
  return groups;
}

export interface JobRequest {
  id: string;
  signature: Signature;
  lang: Language;
  code: string;
  /** Public cases first (their results may be shown), then hidden ones. */
  cases: JudgeCase[];
  /** How many leading cases are public. Run: all of them. Submit: the examples. */
  publicCount: number;
  limits: { timeMs: number; memoryMb: number };
  /** Submit stops at the first failing process; Run reports every case. */
  mode: 'run' | 'submit';
}

export interface JobPlan {
  job: BoxJob;
  groups: Group[];
}

const BOX_LANG: Record<Language, BoxLang> = {
  cpp: 'cpp',
  python: 'python-harness',
  javascript: 'javascript',
};

const MIN_OUTPUT = 256 << 10;

export class JobTooLarge extends Error {}

export function buildJob(req: JobRequest): JobPlan {
  const pub = Math.min(Math.max(0, req.publicCount), req.cases.length);
  const groups: Group[] = [];
  if (pub > 0) groups.push({ start: 0, count: pub, public: true });
  if (req.mode === 'run') {
    if (pub < req.cases.length) throw new Error('Run takes public cases only');
  } else {
    groups.push(...groupCases(req.cases.slice(pub), pub));
  }
  const inputs = groups.map((g) => encodeInput(req.cases.slice(g.start, g.start + g.count)));
  const inputBytes = inputs.reduce((n, s) => n + s.length, 0);
  if (inputs.length > BOX_LIMITS.maxInputs || inputBytes > BOX_LIMITS.maxInputBytes)
    throw new JobTooLarge(`${inputs.length} processes, ${inputBytes} bytes of input`);

  // Room for twice the expected output (records plus a little printing), never below 256 KiB.
  let outputLimit = MIN_OUTPUT;
  for (const g of groups) {
    let bytes = 0;
    for (const c of req.cases.slice(g.start, g.start + g.count))
      bytes += c.expected === undefined ? 0 : canonical(c.expected).length + 2;
    outputLimit = Math.max(outputLimit, 2 * bytes + MIN_OUTPUT);
  }

  const files = { ...buildProgram(req.signature, req.lang, req.code).files };
  // The image carries the prelude and its precompiled header (judge/include).
  if (req.lang === 'cpp') delete files['kc_prelude.hpp'];

  const timeMs = Math.round(req.limits.timeMs * TIME_MULTIPLIER[req.lang]);
  return {
    groups,
    job: {
      id: req.id,
      lang: BOX_LANG[req.lang],
      files,
      inputs,
      timeMs: Math.min(BOX_LIMITS.maxTimeMs, Math.max(BOX_LIMITS.minTimeMs, timeMs)),
      memoryMb: req.limits.memoryMb,
      outputLimit: Math.min(BOX_LIMITS.maxOutputLimit, outputLimit),
      stopOnFailure: req.mode === 'submit',
    },
  };
}
