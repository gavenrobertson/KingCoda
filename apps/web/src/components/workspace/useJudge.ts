'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubmissionView } from '@/lib/submissions';

export type JudgePhase = 'idle' | 'sending' | 'judging' | 'done' | 'failed';

export interface JudgeState {
  phase: JudgePhase;
  mode: 'run' | 'submit' | null;
  view: SubmissionView | null;
  /** A request that never reached the judge (rate limit, validation, network). */
  error: string | null;
  /** The box is probably cold-starting: shown after a few seconds without a verdict. */
  slow: boolean;
}

const IDLE: JudgeState = { phase: 'idle', mode: null, view: null, error: null, slow: false };
const SLOW_AFTER_MS = 4000;
const GIVE_UP_MS = 150_000;

export function useJudge(slug: string, onDone?: (view: SubmissionView) => void) {
  const [state, setState] = useState<JudgeState>(IDLE);
  const run = useRef(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => () => void run.current++, []);

  const start = useCallback(
    async (mode: 'run' | 'submit', code: string, customInput?: string) => {
      const token = ++run.current;
      const live = () => token === run.current;
      setState({ phase: 'sending', mode, view: null, error: null, slow: false });

      let id: string;
      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slug,
            lang: 'cpp',
            mode,
            code,
            ...(customInput !== undefined ? { customInput } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !body.id) throw new Error(body.error ?? `Request failed (${res.status})`);
        id = body.id;
      } catch (e) {
        if (live())
          setState({ phase: 'failed', mode, view: null, error: (e as Error).message, slow: false });
        return;
      }
      if (!live()) return;
      setState((s) => ({ ...s, phase: 'judging' }));

      const began = Date.now();
      const slowTimer = setTimeout(
        () => live() && setState((s) => (s.phase === 'judging' ? { ...s, slow: true } : s)),
        SLOW_AFTER_MS,
      );
      try {
        for (let attempt = 0; live(); attempt++) {
          await new Promise((r) => setTimeout(r, attempt < 40 ? 600 : 1500));
          if (!live()) return;
          const res = await fetch(`/api/submissions/${id}`, { cache: 'no-store' });
          if (res.ok) {
            const view = (await res.json()) as SubmissionView;
            if (view.status === 'done' || view.status === 'error') {
              if (!live()) return;
              setState({ phase: 'done', mode, view, error: null, slow: false });
              onDoneRef.current?.(view);
              return;
            }
          }
          if (Date.now() - began > GIVE_UP_MS)
            throw new Error('The judge is taking too long. Try again in a minute.');
        }
      } catch (e) {
        if (live())
          setState({ phase: 'failed', mode, view: null, error: (e as Error).message, slow: false });
      } finally {
        clearTimeout(slowTimer);
      }
    },
    [slug],
  );

  return { state, start, busy: state.phase === 'sending' || state.phase === 'judging' };
}
