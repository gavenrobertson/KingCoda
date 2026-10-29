import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@kingcoda/db';
import { cn, DifficultyChip } from '@kingcoda/ui';
import { EmptyState } from '@/components/EmptyState';
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  HalfCircleIcon,
  SearchIcon,
  ShuffleIcon,
} from '@/components/icons';
import { ProgressRing } from '@/components/ProgressRing';
import {
  filtersToParams,
  listProblems,
  listTags,
  parseFilters,
  viewerProgress,
  type ProblemFilters,
  type SolveStatus,
} from '@/lib/problems';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Problems' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DIFFICULTY_CHIPS = [
  { label: 'All', value: undefined },
  { label: 'Easy', value: 'Easy' },
  { label: 'Medium', value: 'Medium' },
  { label: 'Hard', value: 'Hard' },
] as const;

const STATUS_CHIPS: Array<{ label: string; value: SolveStatus | undefined }> = [
  { label: 'Any status', value: undefined },
  { label: 'Solved', value: 'solved' },
  { label: 'Attempted', value: 'attempted' },
  { label: 'To do', value: 'todo' },
];

function href(f: ProblemFilters, extra?: Record<string, string>): Route {
  const p = filtersToParams(f);
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
  const qs = p.toString();
  return (qs ? `/problems?${qs}` : '/problems') as Route;
}

function cursorParam(sp: Awaited<SearchParams>, key: string): number | undefined {
  const v = Array.isArray(sp[key]) ? sp[key][0] : sp[key];
  return v && /^\d{1,6}$/.test(v) ? Number(v) : undefined;
}

const segment = (active: boolean) =>
  cn(
    'inline-flex h-[30px] items-center rounded-lg px-3 text-[13px] font-semibold no-underline',
    active ? 'bg-violet text-on-violet' : 'text-text-muted hover:bg-hover hover:text-text',
  );

function StatusIcon({ status }: { status: SolveStatus }) {
  if (status === 'solved')
    return <CheckCircleIcon size={18} className="text-success" label="Solved" />;
  if (status === 'attempted')
    return <HalfCircleIcon size={18} className="text-medium" label="Attempted" />;
  return <CircleIcon size={18} className="text-text-faint" label="Not started" />;
}

export default async function ProblemsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer();
  if (viewer && !viewer.profile) redirect('/welcome');
  const viewerId = viewer?.user.id ?? null;

  const sp = await searchParams;
  const filters = parseFilters(sp);
  if (!viewerId) filters.status = undefined;
  const cursor = { after: cursorParam(sp, 'after'), before: cursorParam(sp, 'before') };

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const [page, tags, progress] = await Promise.all([
    listProblems(db, viewerId, filters, cursor),
    listTags(db),
    viewerProgress(db, viewerId),
  ]);

  if (progress.total === 0) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-8 sm:px-6">
        <EmptyState
          title="No problems yet"
          body="The problem bank is being forged. Check back soon."
        />
      </div>
    );
  }

  const filtered = Boolean(filters.q || filters.difficulty || filters.tag || filters.status);
  const { rows, total, start } = page;

  return (
    <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-4 pb-14 pt-7 sm:px-6">
      <section aria-labelledby="pl-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 id="pl-h" className="font-display text-[32px] font-[750] tracking-[-0.03em]">
            Problems
          </h1>
          <span className="text-[13px] text-text-muted">
            {progress.total} problems{viewerId ? ` · ${progress.solved} solved` : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form
            action="/problems"
            role="search"
            className="flex h-10 min-w-0 flex-[1_1_260px] items-center gap-2 rounded-kc-md border border-border bg-surface px-3 focus-within:border-violet-light"
          >
            <SearchIcon className="text-text-muted" />
            <label htmlFor="kc-search" className="sr-only">
              Search problems
            </label>
            <input
              id="kc-search"
              name="q"
              type="search"
              defaultValue={filters.q ?? ''}
              placeholder="Search by title, topic or number"
              className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint"
            />
            {filters.difficulty && (
              <input type="hidden" name="difficulty" value={filters.difficulty} />
            )}
            {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
            {filters.status && <input type="hidden" name="status" value={filters.status} />}
          </form>
          <nav
            aria-label="Difficulty"
            className="flex gap-1.5 rounded-xl border border-border bg-surface p-1"
          >
            {DIFFICULTY_CHIPS.map((c) => {
              const active = filters.difficulty === c.value;
              return (
                <Link
                  key={c.label}
                  href={href({ ...filters, difficulty: c.value })}
                  aria-current={active ? 'true' : undefined}
                  className={segment(active)}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href={
              `/problems/random${filtersToParams(filters).size ? `?${filtersToParams(filters)}` : ''}` as Route
            }
            prefetch={false}
            className="inline-flex h-10 items-center gap-2 rounded-kc-md border border-violet-tint bg-surface px-3.5 font-semibold text-text no-underline hover:border-violet-light hover:bg-hover"
          >
            <ShuffleIcon className="text-violet-light" />
            Pick one for me
          </Link>
        </div>

        {viewerId && (
          <nav aria-label="Status" className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((c) => {
              const active = filters.status === c.value;
              return (
                <Link
                  key={c.label}
                  href={href({ ...filters, status: c.value })}
                  aria-current={active ? 'true' : undefined}
                  className={segment(active)}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        )}

        <nav aria-label="Topics" className="flex flex-wrap gap-2">
          {tags.map(({ tag, n }) => {
            const active = filters.tag === tag;
            return (
              <Link
                key={tag}
                href={href({ ...filters, tag: active ? undefined : tag })}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex h-[30px] items-center gap-1.5 rounded-kc-pill border px-3 text-[13px] no-underline',
                  active
                    ? 'border-violet-light bg-violet-tint text-text'
                    : 'border-border bg-sunken text-text-muted hover:border-border-strong hover:text-text',
                )}
              >
                {tag}
                <span className="font-mono text-[11px] text-text-faint">{n}</span>
              </Link>
            );
          })}
        </nav>

        <div className="overflow-x-auto rounded-[14px] border border-border bg-sunken">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="h-10 border-b border-border text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
                <th scope="col" className="w-[92px] pl-5 font-bold">
                  Status
                </th>
                <th scope="col" className="font-bold">
                  Title
                </th>
                <th scope="col" className="font-bold">
                  Topics
                </th>
                <th scope="col" className="w-[110px] font-bold">
                  Acceptance
                </th>
                <th scope="col" className="w-[110px] pr-4 font-bold">
                  Difficulty
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.slug}
                  className="h-[52px] border-b border-border-subtle last:border-0 hover:bg-hover"
                >
                  <td className="pl-5">
                    <StatusIcon status={r.status} />
                  </td>
                  <td className="max-w-0 pr-4">
                    <Link
                      href={`/problems/${r.slug}` as Route}
                      className="block truncate font-semibold text-text no-underline hover:underline hover:underline-offset-[3px]"
                    >
                      <span className="font-mono text-[13px] font-medium text-text-muted">
                        {r.number}.
                      </span>{' '}
                      {r.title}
                    </Link>
                  </td>
                  <td className="pr-4">
                    <span className="flex gap-1.5 overflow-hidden">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="whitespace-nowrap rounded-kc-sm bg-raised px-2 py-0.5 text-xs text-text-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="font-mono text-[13px] text-text-muted">
                    {r.acceptanceRate == null ? '—' : `${(r.acceptanceRate * 100).toFixed(1)}%`}
                  </td>
                  <td className="pr-4">
                    <DifficultyChip difficulty={r.difficulty} className="text-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-6 py-12 text-center text-text-muted">
              No problems match these filters. <Link href="/problems">Clear filters</Link>
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-[13px] text-text-muted">
              Showing {start + 1}–{start + rows.length} of {total}
              {filtered ? ' matching' : ''}
            </span>
            <div className="flex gap-1.5">
              <PageLink
                disabled={page.prev === null}
                href={href(filters, page.prev === null ? {} : { before: String(page.prev) })}
                label="Previous page"
              >
                <ChevronLeftIcon />
              </PageLink>
              <PageLink
                disabled={page.next === null}
                href={href(filters, page.next === null ? {} : { after: String(page.next) })}
                label="Next page"
              >
                <ChevronRightIcon />
              </PageLink>
            </div>
          </nav>
        )}
      </section>

      <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-4">
        <section
          aria-labelledby="prog-h"
          className="flex flex-col gap-4 rounded-kc-lg border border-border bg-surface p-5"
        >
          <h2 id="prog-h" className="text-[15px] font-bold">
            Your progress
          </h2>
          {viewerId ? (
            <div className="flex items-center gap-5">
              <div className="relative size-32 flex-none">
                <ProgressRing
                  total={progress.total}
                  segments={[
                    { value: progress.byDifficulty.Easy.solved, className: 'stroke-easy' },
                    { value: progress.byDifficulty.Medium.solved, className: 'stroke-medium' },
                    { value: progress.byDifficulty.Hard.solved, className: 'stroke-hard' },
                  ]}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[30px] font-[750] leading-none">
                    {progress.solved}
                  </span>
                  <span className="text-xs text-text-muted">of {progress.total}</span>
                </div>
              </div>
              <dl className="flex min-w-0 flex-1 flex-col gap-2.5">
                {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                  <div key={d} className="flex justify-between gap-2">
                    <dt
                      className={cn(
                        'font-semibold',
                        d === 'Easy' ? 'text-easy' : d === 'Medium' ? 'text-medium' : 'text-hard',
                      )}
                    >
                      {d}
                    </dt>
                    <dd className="font-mono text-[13px]">
                      {progress.byDifficulty[d].solved}
                      <span className="text-text-muted">/{progress.byDifficulty[d].total}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-text-muted">
              <Link href="/sign-in">Sign in</Link> to track what you&apos;ve solved and keep a
              streak.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function PageLink({
  href,
  label,
  disabled,
  children,
}: {
  href: Route;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls =
    'flex size-9 items-center justify-center rounded-[9px] border border-border bg-surface text-text-muted';
  if (disabled)
    return (
      <span aria-disabled="true" aria-label={label} role="link" className={cn(cls, 'opacity-40')}>
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(cls, 'no-underline hover:border-border-strong hover:bg-hover hover:text-text')}
    >
      {children}
    </Link>
  );
}
