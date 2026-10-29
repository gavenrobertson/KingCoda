'use client';
import { useEffect, useState } from 'react';
import { cn } from '@kingcoda/ui';
import { formatMemory, timeAgo, VERDICT_LABEL, VERDICT_TONE } from './format';

interface Row {
  id: string;
  verdict: string | null;
  status: string;
  passed: number | null;
  total: number | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: number;
}

/** The viewer's submissions for this problem, newest first. `refreshKey` reloads it. */
export function SubmissionsList({
  slug,
  refreshKey,
  signedIn,
}: {
  slug: string;
  refreshKey: number;
  signedIn: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetch(`/api/submissions?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json()) as { submissions?: Row[]; error?: string };
        if (!live) return;
        if (!r.ok) setError(body.error ?? 'Could not load submissions');
        else setRows(body.submissions ?? []);
      })
      .catch(() => live && setError('Could not load submissions'));
    return () => {
      live = false;
    };
  }, [slug, refreshKey, signedIn]);

  if (!signedIn)
    return <p className="text-text-muted">Sign in to keep a history of your submissions.</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!rows) return <p className="text-text-muted">Loading…</p>;
  if (rows.length === 0)
    return (
      <p className="text-text-muted">
        No submissions yet. Submit when your code passes the examples.
      </p>
    );
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <thead>
        <tr className="h-9 border-b border-border text-xs uppercase tracking-[0.08em] text-text-muted">
          <th scope="col" className="font-bold">
            Verdict
          </th>
          <th scope="col" className="font-bold">
            Runtime
          </th>
          <th scope="col" className="font-bold">
            Memory
          </th>
          <th scope="col" className="font-bold">
            When
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="h-11 border-b border-border-subtle last:border-0">
            <td className={cn('font-semibold', VERDICT_TONE[r.verdict ?? ''] ?? 'text-text-muted')}>
              {r.status === 'done' || r.status === 'error'
                ? (VERDICT_LABEL[r.verdict ?? ''] ?? r.verdict)
                : 'Judging…'}
              {r.verdict && r.verdict !== 'AC' && r.total ? (
                <span className="ml-2 font-mono text-xs font-normal text-text-muted">
                  {r.passed}/{r.total}
                </span>
              ) : null}
            </td>
            <td className="font-mono">{r.runtimeMs == null ? '—' : `${r.runtimeMs} ms`}</td>
            <td className="font-mono">{r.memoryKb == null ? '—' : formatMemory(r.memoryKb)}</td>
            <td className="text-text-muted">{timeAgo(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
