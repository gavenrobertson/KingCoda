'use client';
import { useState } from 'react';
import type { CaseReport, Failure, Verdict } from '@kingcoda/judge-core';
import { cn } from '@kingcoda/ui';
import { CheckCircleIcon, SpinnerIcon, XIcon } from '@/components/icons';
import { formatArgs, formatMemory, formatValue, VERDICT_LABEL, VERDICT_TONE } from './format';
import type { JudgeState } from './useJudge';

type Report = Partial<Verdict> & { failure?: Failure; cases?: CaseReport[] };

export interface ResultPanelProps {
  state: JudgeState;
  paramNames: string[];
  /** The next hint the viewer can open, if one is unlocked and not yet read. */
  hintReady: number | null;
  onShowHint: () => void;
}

export function ResultPanel({ state, paramNames, hintReady, onShowHint }: ResultPanelProps) {
  if (state.phase === 'idle')
    return (
      <Shell>
        <p className="text-text-muted">
          Run your code against the test cases, or submit it against the full suite.{' '}
          <span className="font-mono text-xs">Ctrl ⏎</span> runs,{' '}
          <span className="font-mono text-xs">Ctrl ⇧ ⏎</span> submits.
        </p>
      </Shell>
    );
  if (state.phase === 'sending' || state.phase === 'judging')
    return (
      <Shell>
        <div role="status" className="flex items-center gap-3">
          <SpinnerIcon size={18} className="text-violet-light" />
          <div className="flex flex-col">
            <span className="font-semibold">
              {state.mode === 'submit' ? 'Judging your submission…' : 'Running…'}
            </span>
            {state.slow && (
              <span className="text-[13px] text-text-muted">
                Waking the judge. The first run of a session takes about 15 seconds; after that
                it&apos;s quick.
              </span>
            )}
          </div>
        </div>
      </Shell>
    );
  if (state.phase === 'failed' || !state.view)
    return (
      <Shell>
        <p role="alert" className="text-danger">
          {state.error ?? 'Something went wrong.'}
        </p>
      </Shell>
    );

  const view = state.view;
  const report = (view.report ?? {}) as Report;
  const verdict = view.verdict ?? 'IE';

  if (verdict === 'CE')
    return (
      <Shell>
        <Headline verdict="CE" detail="Fix the first error; later ones often follow from it." />
        <pre className="max-h-64 overflow-auto rounded-kc-md border border-border bg-sunken p-3 font-mono text-[12.5px] leading-relaxed text-text whitespace-pre-wrap">
          {view.compileLog ?? 'Compilation failed.'}
        </pre>
      </Shell>
    );

  if (view.mode === 'run')
    return <RunResult report={report} verdict={verdict} paramNames={paramNames} />;
  return (
    <SubmitResult
      report={report}
      verdict={verdict}
      view={view}
      paramNames={paramNames}
      hintReady={hintReady}
      onShowHint={onShowHint}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">{children}</div>
  );
}

function Headline({ verdict, detail }: { verdict: string; detail?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
      <span
        className={cn(
          'font-display font-[750] tracking-[-0.02em]',
          verdict === 'AC' ? 'kc-pop text-[28px]' : 'text-[22px]',
          VERDICT_TONE[verdict],
        )}
      >
        {VERDICT_LABEL[verdict] ?? verdict}
      </span>
      {detail && <span className="text-[13px] text-text-muted">{detail}</span>}
    </div>
  );
}

function ValueCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-kc-md border px-3 py-2.5 font-mono text-[13px]',
        tone === 'good' && 'border-success/30 bg-success/10',
        tone === 'bad' && 'border-danger/30 bg-danger/10',
        !tone && 'border-border bg-surface',
      )}
    >
      <span
        className={cn(
          'font-sans text-xs',
          tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : 'text-text-muted',
        )}
      >
        {label}
      </span>
      <span className="break-all whitespace-pre-wrap">{value}</span>
    </div>
  );
}

function Printed({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">Your printing (stdout)</span>
      <pre className="max-h-40 overflow-auto rounded-kc-md border border-border bg-sunken p-2.5 font-mono text-[12.5px] whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function RunResult({
  report,
  verdict,
  paramNames,
}: {
  report: Report;
  verdict: string;
  paramNames: string[];
}) {
  const cases = report.cases ?? [];
  const [pick, setPick] = useState(() =>
    Math.max(
      0,
      cases.findIndex((c) => c.verdict !== 'AC'),
    ),
  );
  const c = cases[Math.min(pick, cases.length - 1)];
  const passed = cases.filter((x) => x.verdict === 'AC').length;
  return (
    <Shell>
      <Headline
        verdict={verdict}
        detail={
          verdict === 'IE'
            ? report.failure?.message
            : `${passed} of ${cases.length} test cases passed`
        }
      />
      {cases.length > 0 && (
        <div role="tablist" aria-label="Test cases" className="flex flex-wrap gap-1.5">
          {cases.map((x, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === pick}
              onClick={() => setPick(i)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold',
                i === pick
                  ? 'border-border-strong bg-raised text-text'
                  : 'border-transparent text-text-muted hover:bg-hover',
              )}
            >
              {x.verdict === 'AC' ? (
                <CheckCircleIcon size={14} className="text-success" label="passed" />
              ) : (
                <XIcon size={14} className="text-danger" label="failed" />
              )}
              Case {i + 1}
            </button>
          ))}
        </div>
      )}
      {c && (
        <div role="tabpanel" className="flex flex-col gap-2.5">
          <ValueCard label="Input" value={formatArgs(paramNames, c.input)} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ValueCard
              label="Expected"
              value={
                c.expected === undefined
                  ? 'Unknown: the reference solution rejected this input. Is it inside the constraints?'
                  : formatValue(c.expected)
              }
              tone="good"
            />
            <ValueCard
              label="Your output"
              value={c.actual !== undefined ? formatValue(c.actual) : (c.message ?? 'No output')}
              tone={c.verdict === 'AC' ? undefined : 'bad'}
            />
          </div>
          {c.message && c.actual === undefined && c.message !== 'Not run' && (
            <pre className="max-h-40 overflow-auto rounded-kc-md border border-danger/30 bg-danger/10 p-2.5 font-mono text-[12.5px] text-text whitespace-pre-wrap">
              {c.message}
            </pre>
          )}
          <Printed text={c.printed} />
        </div>
      )}
    </Shell>
  );
}

const ADVICE: Record<string, string> = {
  TLE: 'Your solution is too slow for the largest inputs. Look for a better time complexity.',
  MLE: 'Your solution uses too much memory. Look for a leaner data structure.',
  OLE: 'Your code printed too much. Remove debug output before submitting.',
  RE: 'Your code crashed. Check array bounds, null pointers and division by zero.',
  IE: 'This one is on us, not your code. Try again in a minute.',
};

function SubmitResult({
  report,
  verdict,
  view,
  paramNames,
  hintReady,
  onShowHint,
}: {
  report: Report;
  verdict: string;
  view: NonNullable<JudgeState['view']>;
  paramNames: string[];
  hintReady: number | null;
  onShowHint: () => void;
}) {
  const passed = view.passed ?? 0;
  const total = view.total ?? 0;
  if (verdict === 'AC')
    return (
      <Shell>
        <Headline verdict="AC" detail={`${total} / ${total} tests passed`} />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Runtime" value={`${view.runtimeMs ?? 0}`} unit="ms" />
          <Stat
            label="Memory"
            value={formatMemory(view.memoryKb ?? 0).split(' ')[0]!}
            unit={formatMemory(view.memoryKb ?? 0).split(' ')[1]!}
          />
        </div>
        <p className="text-[13px] text-text-muted">
          Runtime percentiles appear once enough people have solved this problem.
        </p>
      </Shell>
    );

  const f = report.failure;
  const publicCase = f?.input !== undefined;
  const closeness = total > 0 && passed / total >= 0.7 ? ' — close.' : '.';
  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'rounded-kc-pill px-2.5 py-0.5 text-xs font-bold',
            VERDICT_TONE[verdict],
            'bg-raised',
          )}
        >
          {VERDICT_LABEL[verdict] ?? verdict}
        </span>
        {total > 0 && (
          <span className="font-display text-[22px] font-[750] tracking-[-0.02em]">
            {passed} of {total} passing{closeness}
          </span>
        )}
      </div>
      {f && publicCase && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <ValueCard label="Input" value={formatArgs(paramNames, f.input!)} />
          <ValueCard label="Expected" value={formatValue(f.expected)} tone="good" />
          <ValueCard
            label="Your output"
            value={f.actual !== undefined ? formatValue(f.actual) : (f.message ?? '—')}
            tone="bad"
          />
        </div>
      )}
      {f && !publicCase && (
        <p className="text-text">
          Failed on hidden test <span className="font-mono">{f.index + 1}</span> of{' '}
          <span className="font-mono">{total}</span>
          {f.category ? (
            <>
              {' '}
              · <span className="font-semibold">{f.category}</span>
            </>
          ) : null}
          . Hidden tests stay hidden, but the label says what kind of input it was.
        </p>
      )}
      {ADVICE[verdict] && <p className="text-[13px] text-text-muted">{ADVICE[verdict]}</p>}
      {f?.message && verdict === 'RE' && (
        <pre className="max-h-40 overflow-auto rounded-kc-md border border-border bg-sunken p-2.5 font-mono text-[12.5px] whitespace-pre-wrap">
          {f.message}
        </pre>
      )}
      {f?.printed ? <Printed text={f.printed} /> : null}
      {hintReady !== null && verdict !== 'IE' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-kc-md border border-violet-tint bg-violet-tint/40 px-3.5 py-2.5">
          <span>Hint {hintReady} is ready whenever you want it.</span>
          <button
            type="button"
            onClick={onShowHint}
            className="h-9 rounded-[9px] border border-violet-light/50 bg-surface px-3.5 font-semibold text-text hover:bg-hover"
          >
            Show hint {hintReady}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3.5 py-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="font-mono text-xl font-bold">
        {value} <span className="text-[13px] font-medium text-text-muted">{unit}</span>
      </span>
    </div>
  );
}
