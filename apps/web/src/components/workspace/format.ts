// Display helpers shared by the statement's examples and the result console.

const MAX_SHOWN = 4000;

/** Compact JSON, cut short for very large values. */
export function formatValue(v: unknown): string {
  const s = v === undefined ? '' : JSON.stringify(v);
  return s.length > MAX_SHOWN ? `${s.slice(0, MAX_SHOWN)}…` : s;
}

/** `weights = [4,9,1,6], target = 7`, in signature order. */
export function formatArgs(names: string[], args: unknown[]): string {
  return names.map((n, i) => `${n} = ${formatValue(args[i])}`).join(', ');
}

export function formatMemory(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const VERDICT_LABEL: Record<string, string> = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  MLE: 'Memory Limit Exceeded',
  OLE: 'Output Limit Exceeded',
  RE: 'Runtime Error',
  CE: 'Compile Error',
  IE: 'Judge Error',
};

/** Tailwind text color per verdict (docs/DESIGN.md › Verdicts). */
export const VERDICT_TONE: Record<string, string> = {
  AC: 'text-success',
  WA: 'text-danger',
  RE: 'text-danger',
  TLE: 'text-warning',
  MLE: 'text-warning',
  OLE: 'text-warning',
  CE: 'text-text-muted',
  IE: 'text-text-muted',
};
