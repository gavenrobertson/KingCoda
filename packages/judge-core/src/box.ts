// The judge box's wire format (judge/kc-run/job.go). Keep the two in step.

export type BoxLang = 'cpp' | 'python-harness' | 'javascript';

export interface BoxJob {
  id: string;
  lang: BoxLang;
  files: Record<string, string>;
  /** One stdin per process. Expected outputs never go to the box. */
  inputs: string[];
  timeMs: number;
  memoryMb: number;
  outputLimit: number;
  /** Stop after the first process that doesn't exit cleanly. */
  stopOnFailure: boolean;
}

export type BoxStatus = 'ok' | 'tle' | 'mle' | 'ole' | 're' | 'ce' | 'sandbox_fail';

export interface BoxStep {
  status: BoxStatus;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  cpuMs: number;
  wallMs: number;
  maxRssKb: number;
}

export interface BoxResult {
  id: string;
  compile?: BoxStep;
  tests: BoxStep[];
  strays: number;
}

/** kc-run's own bounds, so a job is rejected here rather than by the box. */
export const BOX_LIMITS = {
  maxInputs: 500,
  maxInputBytes: 24 << 20,
  maxOutputLimit: 16 << 20,
  minTimeMs: 50,
  maxTimeMs: 20_000,
} as const;
