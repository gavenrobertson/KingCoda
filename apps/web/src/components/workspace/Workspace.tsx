'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  Button,
  cn,
  CrownMark,
  DifficultyChip,
  StreakFlame,
  XpBar,
  type Difficulty,
} from '@kingcoda/ui';
import {
  BulbIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudCheckIcon,
  ListIcon,
  LockIcon,
  PlayIcon,
  ResetIcon,
  SendIcon,
  SpinnerIcon,
} from '@/components/icons';
import { formatArgs, formatValue } from './format';
import { ResultPanel } from './ResultPanel';
import { Splitter } from './Splitter';
import { SubmissionsList } from './SubmissionsList';
import { useJudge } from './useJudge';

// Monaco touches `window`, so it only ever renders in the browser.
const CodeEditor = dynamic(() => import('./CodeEditor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => (
    <div className="p-4 font-mono text-[13px] text-text-muted">Loading the editor…</div>
  ),
});

export interface WorkspaceProblem {
  slug: string;
  number: number;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  acceptanceRate: number | null;
  /** Sanitized on the server (lib/markdown). */
  statementHtml: string;
  constraints: string[];
  paramNames: string[];
  examples: Array<{ args: unknown[]; output: unknown; explanation?: string }>;
  /** `text` is null while the hint is locked: locked hints never reach the browser. */
  hints: Array<{ tier: number; unlockAfterWrong: number; text: string | null }>;
  /** Wrong submissions so far; null once solved. */
  wrongCount: number | null;
  solved: boolean;
  starterCode: string;
  initialCode: string;
  defaultCustomInput: string;
  license: string;
  source: string;
  prevSlug: string | null;
  nextSlug: string | null;
}

export interface WorkspaceViewer {
  handle: string;
  streak: number;
  xp: number;
  level: number;
  intoLevel: number;
  levelSpan: number;
  nextAt: number;
}

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

function usePersistent(key: string, initial: number): [number, (v: number) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(key));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-browser layout preference after hydration
      if (v > 0) setValue(v);
    } catch {
      // storage unavailable: keep the default
    }
  }, [key]);
  const set = useCallback(
    (v: number) => {
      setValue(v);
      try {
        localStorage.setItem(key, String(Math.round(v)));
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, set];
}

const COMPILE_LINE = /solution\.cpp:(\d+):/;

export function Workspace({
  problem,
  viewer,
}: {
  problem: WorkspaceProblem;
  viewer: WorkspaceViewer | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState(problem.initialCode);
  const [save, setSave] = useState<SaveState>('saved');
  const [custom, setCustom] = useState(problem.defaultCustomInput);
  const [leftTab, setLeftTab] = useState<'description' | 'submissions'>('description');
  const [consoleTab, setConsoleTab] = useState<'cases' | 'result'>('cases');
  const [split, setSplit] = usePersistent('kc-ws-split', 44);
  const [editorShare, setEditorShare] = usePersistent('kc-ws-editor', 62);
  const [subsKey, setSubsKey] = useState(0);
  const [opened, setOpened] = useState<number[]>([]);
  const hintsRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  // Run/Submit read the latest code from refs: a shortcut pressed right after an edit can fire
  // before React re-renders with the new state.
  const codeRef = useRef(code);
  const customRef = useRef(custom);

  const { state, start, busy } = useJudge(problem.slug, (view) => {
    setSubsKey((k) => k + 1);
    // Progress, unlocked hints and the solved mark come from the server.
    if (view.mode === 'submit') router.refresh();
  });

  // Wake the judge box while the problem is read, so the first Run skips most of the cold start.
  useEffect(() => {
    if (viewer) void fetch('/api/judge/warm', { method: 'POST' }).catch(() => undefined);
  }, [viewer]);

  // Autosave, debounced.
  useEffect(() => {
    if (!viewer || !dirty.current) return;
    const t = setTimeout(async () => {
      setSave('saving');
      try {
        const res = await fetch('/api/drafts', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: problem.slug, lang: 'cpp', code }),
        });
        setSave(res.ok ? 'saved' : 'error');
      } catch {
        setSave('error');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [code, viewer, problem.slug]);

  const onCode = useCallback((v: string) => {
    dirty.current = true;
    codeRef.current = v;
    setSave('unsaved');
    setCode(v);
  }, []);

  const onCustom = (v: string) => {
    customRef.current = v;
    setCustom(v);
  };

  const run = useCallback(() => {
    if (!viewer) return router.push('/sign-in');
    if (busy) return;
    setConsoleTab('result');
    void start('run', codeRef.current, customRef.current);
  }, [viewer, busy, start, router]);

  const submit = useCallback(() => {
    if (!viewer) return router.push('/sign-in');
    if (busy) return;
    setConsoleTab('result');
    void start('submit', codeRef.current);
  }, [viewer, busy, start, router]);

  // Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits. The editor binds the same keys itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
      if ((e.target as Element | null)?.closest?.('.monaco-editor')) return;
      e.preventDefault();
      if (e.shiftKey) submit();
      else run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, submit]);

  const reset = async () => {
    if (!window.confirm('Replace your code with the starter code?')) return;
    dirty.current = false;
    codeRef.current = problem.starterCode;
    setCode(problem.starterCode);
    setSave('saved');
    if (viewer)
      await fetch(`/api/drafts?slug=${encodeURIComponent(problem.slug)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
  };

  const compileLine =
    state.view?.verdict === 'CE'
      ? Number(COMPILE_LINE.exec(state.view.compileLog ?? '')?.[1]) || null
      : null;
  const unlockedUnread = problem.hints.find((h) => h.text !== null && !opened.includes(h.tier));
  const showHint = (tier: number) => {
    setOpened((o) => (o.includes(tier) ? o : [...o, tier]));
    setLeftTab('description');
    requestAnimationFrame(() =>
      hintsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ground max-[860px]:h-auto max-[860px]:overflow-visible">
      <header className="flex min-h-[52px] flex-none flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-2">
        <Link
          href="/"
          aria-label="KingCoda home"
          className="flex items-center gap-2 text-text no-underline"
        >
          <CrownMark size={26} />
          <span className="font-display text-lg font-[750] tracking-[-0.02em] max-sm:hidden">
            KingCoda
          </span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-border" />
        <Link
          href="/problems"
          className="flex items-center gap-1.5 text-[13px] text-text-muted no-underline hover:text-text"
        >
          <ListIcon /> Problem list
        </Link>
        <div className="flex gap-1">
          <NavArrow slug={problem.prevSlug} label="Previous problem">
            <ChevronLeftIcon />
          </NavArrow>
          <NavArrow slug={problem.nextSlug} label="Next problem">
            <ChevronRightIcon />
          </NavArrow>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 max-[860px]:hidden">
          <Button size="sm" onClick={run} disabled={busy} aria-keyshortcuts="Control+Enter">
            {busy && state.mode === 'run' ? <SpinnerIcon /> : <PlayIcon />}
            Run
            <kbd className="font-mono text-[11px] font-medium text-text-muted">Ctrl ⏎</kbd>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={submit}
            disabled={busy}
            aria-keyshortcuts="Control+Shift+Enter"
          >
            {busy && state.mode === 'submit' ? <SpinnerIcon /> : <SendIcon />}
            Submit
            <kbd className="font-mono text-[11px] font-medium text-on-violet/80">Ctrl ⇧ ⏎</kbd>
          </Button>
        </div>
        <div className="flex-1" />
        {viewer ? (
          <div className="flex items-center gap-3">
            <StreakFlame streak={viewer.streak} />
            <XpBar
              compact
              className="hidden w-[120px] lg:flex"
              level={viewer.level}
              xp={viewer.xp}
              nextAt={viewer.nextAt}
              intoLevel={viewer.intoLevel}
              levelSpan={viewer.levelSpan}
            />
          </div>
        ) : (
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center rounded-kc-md bg-violet px-3.5 font-semibold text-on-violet no-underline hover:bg-violet-hover"
          >
            Sign in to run code
          </Link>
        )}
      </header>

      <div id="main" className="flex min-h-0 flex-1 max-[860px]:block">
        <section
          aria-label="Problem"
          style={{ flexBasis: `${split}%` }}
          className="flex min-w-0 flex-none flex-col max-[860px]:!basis-full"
        >
          <div
            role="tablist"
            aria-label="Problem sections"
            className="flex flex-none gap-0.5 overflow-x-auto border-b border-border-subtle px-3"
          >
            {(
              [
                ['description', 'Description'],
                ['submissions', 'Submissions'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={leftTab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setLeftTab(id)}
                className={cn(
                  'h-[42px] border-b-2 px-3 font-semibold',
                  leftTab === id
                    ? 'border-gold text-text'
                    : 'border-transparent text-text-muted hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {leftTab === 'description' ? (
            <div
              id="panel-description"
              role="tabpanel"
              aria-labelledby="tab-description"
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pb-8 pt-6 max-sm:px-4"
            >
              <div className="flex flex-col gap-2.5">
                <h1 className="font-display text-[26px] font-bold tracking-[-0.02em]">
                  {problem.number}. {problem.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <DifficultyChip difficulty={problem.difficulty} className="text-xs" />
                  {problem.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-kc-sm bg-raised px-2 py-0.5 text-xs text-text-muted"
                    >
                      {t}
                    </span>
                  ))}
                  {problem.acceptanceRate != null && (
                    <span className="text-xs text-text-muted">
                      Acceptance {(problem.acceptanceRate * 100).toFixed(1)}%
                    </span>
                  )}
                  {problem.solved && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success">
                      <CheckCircleIcon size={14} /> Solved
                    </span>
                  )}
                </div>
              </div>

              <div
                className="kc-prose"
                dangerouslySetInnerHTML={{ __html: problem.statementHtml }}
              />

              {problem.examples.map((ex, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <h2 className="text-sm font-bold">Example {i + 1}</h2>
                  <div className="flex flex-col gap-1 rounded-kc-md border border-border-subtle bg-sunken px-3.5 py-3 font-mono text-[13px]">
                    <div>
                      <span className="text-text-muted">Input:</span>{' '}
                      {formatArgs(problem.paramNames, ex.args)}
                    </div>
                    <div>
                      <span className="text-text-muted">Output:</span> {formatValue(ex.output)}
                    </div>
                    {ex.explanation && (
                      <div className="font-sans text-[13px] text-text-muted">{ex.explanation}</div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-bold">Constraints</h2>
                <ul className="flex list-disc flex-col gap-1 pl-5 font-mono text-[13px] text-text">
                  {problem.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <div ref={hintsRef} className="flex scroll-mt-4 flex-col gap-2">
                <h2 className="text-sm font-bold">Hints</h2>
                {problem.hints.map((h) =>
                  h.text !== null && opened.includes(h.tier) ? (
                    <div
                      key={h.tier}
                      className="kc-pop flex flex-col gap-1.5 rounded-kc-md border border-violet-tint bg-violet-tint/40 px-3.5 py-3"
                    >
                      <span className="text-xs font-bold uppercase tracking-[0.04em] text-violet-light">
                        Hint {h.tier} · unlocked
                      </span>
                      <span>{h.text}</span>
                    </div>
                  ) : h.text !== null ? (
                    <button
                      key={h.tier}
                      type="button"
                      onClick={() => showHint(h.tier)}
                      className="flex items-center gap-2.5 rounded-kc-md border border-violet-tint px-3.5 py-3 text-left font-semibold text-text hover:bg-hover"
                    >
                      <BulbIcon className="text-violet-light" /> Show hint {h.tier}
                    </button>
                  ) : (
                    <div
                      key={h.tier}
                      className="flex items-center gap-2.5 rounded-kc-md border border-dashed border-border-strong px-3.5 py-3 text-text-muted"
                    >
                      <LockIcon />
                      <span>
                        Hint {h.tier} unlocks after {h.unlockAfterWrong} wrong answer
                        {h.unlockAfterWrong === 1 ? '' : 's'}
                        {problem.wrongCount !== null && problem.wrongCount > 0
                          ? ` (${h.unlockAfterWrong - problem.wrongCount} to go)`
                          : ''}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div className="flex flex-wrap justify-between gap-3 border-t border-border-subtle pt-3.5 text-xs text-text-muted">
                <span>
                  {problem.source} · {problem.license}
                </span>
              </div>

              <div className="hidden flex-col gap-2.5 rounded-xl border border-violet-tint bg-violet-tint/40 p-4 max-[860px]:flex">
                <strong>The editor is built for a bigger screen</strong>
                <span className="text-text-muted">
                  Read the problem here, then pick it up on a laptop.
                  {viewer ? ' Your code is saved as you type.' : ''}
                </span>
                <Link href="/problems" className="font-semibold">
                  Back to the problem list
                </Link>
              </div>
            </div>
          ) : (
            <div
              id="panel-submissions"
              role="tabpanel"
              aria-labelledby="tab-submissions"
              className="min-h-0 flex-1 overflow-y-auto px-7 py-6 max-sm:px-4"
            >
              <SubmissionsList
                slug={problem.slug}
                refreshKey={subsKey}
                signedIn={Boolean(viewer)}
              />
            </div>
          )}
        </section>

        <Splitter
          orientation="vertical"
          value={split}
          min={25}
          max={70}
          onChange={setSplit}
          label="Resize problem and code panes"
          className="max-[860px]:hidden"
        />

        <section aria-label="Code" className="flex min-w-0 flex-1 flex-col max-[860px]:hidden">
          <div className="flex h-[42px] flex-none items-center gap-2.5 border-b border-border-subtle px-3">
            <span
              className="inline-flex h-[30px] items-center rounded-lg border border-border px-2.5 text-[13px] font-semibold"
              title="More languages are coming"
            >
              C++20
            </span>
            <SaveBadge state={viewer ? save : null} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={reset}
              aria-label="Reset to starter code"
              title="Reset to starter code"
              className="flex size-[30px] items-center justify-center rounded-lg text-text-muted hover:bg-hover hover:text-text"
            >
              <ResetIcon />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div style={{ flexBasis: `${editorShare}%` }} className="min-h-0 flex-none bg-sunken">
              <CodeEditor
                value={code}
                onChange={onCode}
                onRun={run}
                onSubmit={submit}
                errorLine={compileLine}
              />
            </div>
            <Splitter
              orientation="horizontal"
              value={editorShare}
              min={25}
              max={85}
              onChange={setEditorShare}
              label="Resize editor and console"
            />
            <div className="flex min-h-0 flex-1 flex-col bg-ground">
              <div
                role="tablist"
                aria-label="Console"
                className="flex flex-none gap-0.5 border-b border-border-subtle px-3"
              >
                {(
                  [
                    ['cases', 'Test cases'],
                    ['result', 'Result'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`ctab-${id}`}
                    aria-selected={consoleTab === id}
                    aria-controls={`cpanel-${id}`}
                    onClick={() => setConsoleTab(id)}
                    className={cn(
                      'h-[38px] border-b-2 px-3 font-semibold',
                      consoleTab === id
                        ? 'border-gold text-text'
                        : 'border-transparent text-text-muted hover:text-text',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {consoleTab === 'cases' ? (
                <div
                  id="cpanel-cases"
                  role="tabpanel"
                  aria-labelledby="ctab-cases"
                  className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="kc-custom" className="text-[13px] text-text-muted">
                      One JSON value per line, in order:{' '}
                      <span className="font-mono text-text">{problem.paramNames.join(', ')}</span>.
                      A blank line starts the next test.
                    </label>
                    <button
                      type="button"
                      onClick={() => onCustom(problem.defaultCustomInput)}
                      className="text-[13px] font-semibold text-violet-light hover:underline"
                    >
                      Reset to examples
                    </button>
                  </div>
                  <textarea
                    id="kc-custom"
                    value={custom}
                    onChange={(e) => onCustom(e.target.value)}
                    spellCheck={false}
                    className="min-h-24 flex-1 resize-none rounded-kc-md border border-border bg-sunken p-3 font-mono text-[13px] text-text outline-none focus:border-violet-light"
                  />
                </div>
              ) : (
                <div
                  id="cpanel-result"
                  role="tabpanel"
                  aria-labelledby="ctab-result"
                  className="flex min-h-0 flex-1 flex-col"
                  aria-live="polite"
                >
                  <ResultPanel
                    state={state}
                    paramNames={problem.paramNames}
                    hintReady={unlockedUnread?.tier ?? null}
                    onShowHint={() => unlockedUnread && showHint(unlockedUnread.tier)}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function NavArrow({
  slug,
  label,
  children,
}: {
  slug: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    'flex size-8 items-center justify-center rounded-lg border border-border text-text-muted';
  if (!slug)
    return (
      <span aria-label={label} aria-disabled="true" role="link" className={cn(cls, 'opacity-40')}>
        {children}
      </span>
    );
  return (
    <Link
      href={`/problems/${slug}` as Route}
      aria-label={label}
      className={cn(cls, 'no-underline hover:bg-hover hover:text-text')}
    >
      {children}
    </Link>
  );
}

function SaveBadge({ state }: { state: SaveState | null }) {
  if (state === null)
    return <span className="text-xs text-text-muted">Sign in to save your code</span>;
  const text = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved',
    error: 'Not saved, retrying on your next edit',
  }[state];
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs',
        state === 'error' ? 'text-danger' : 'text-text-muted',
      )}
      aria-live="polite"
    >
      {state === 'saved' && <CloudCheckIcon size={14} />}
      {text}
    </span>
  );
}
