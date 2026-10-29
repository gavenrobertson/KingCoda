import 'server-only';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { DIFFICULTIES, problem, problemTag, userProblem, type Db } from '@kingcoda/db';

export type Difficulty = (typeof DIFFICULTIES)[number];
export const STATUSES = ['solved', 'attempted', 'todo'] as const;
export type SolveStatus = (typeof STATUSES)[number];

export interface ProblemFilters {
  q?: string;
  difficulty?: Difficulty;
  tag?: string;
  /** Needs a viewer; ignored when signed out. */
  status?: SolveStatus;
}

export interface ProblemRow {
  number: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  acceptanceRate: number | null;
  status: SolveStatus;
}

export const PAGE_SIZE = 25;

/**
 * FTS5 query from free text: each word becomes a quoted prefix term (so punctuation and FTS
 * operators in the input can't change the query's meaning), all of them required.
 */
export function ftsQuery(q: string): string | null {
  const words =
    q
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 8) ?? [];
  return words.length ? words.map((w) => `"${w}"*`).join(' ') : null;
}

function filterConditions(f: ProblemFilters, viewerId: string | null): SQL[] {
  const where: SQL[] = [eq(problem.status, 'published')];
  if (f.difficulty) where.push(eq(problem.difficultyDisplay, f.difficulty));
  if (f.tag) {
    where.push(
      sql`exists (select 1 from ${problemTag} where ${problemTag.problemId} = ${problem.id} and ${problemTag.tag} = ${f.tag})`,
    );
  }
  const q = f.q?.trim();
  if (q) {
    const match = ftsQuery(q);
    const byText = match
      ? inArray(
          problem.number,
          sql`(select rowid from problem_fts where problem_fts match ${match})`,
        )
      : undefined;
    const n = /^\d{1,6}$/.test(q) ? eq(problem.number, Number(q)) : undefined;
    where.push(or(byText, n) ?? sql`0`);
  }
  if (f.status && viewerId) {
    if (f.status === 'todo') where.push(isNull(userProblem.status));
    else where.push(eq(userProblem.status, f.status));
  }
  return where;
}

function joinViewer(viewerId: string | null) {
  return and(eq(userProblem.problemId, problem.id), eq(userProblem.userId, viewerId ?? ''));
}

const rowFields = {
  number: problem.number,
  slug: problem.slug,
  title: problem.title,
  difficulty: problem.difficultyDisplay,
  tags: problem.tags,
  acceptanceRate: problem.acceptanceRate,
  status: userProblem.status,
};

export interface ProblemPage {
  rows: ProblemRow[];
  total: number;
  /** Zero-based position of the first row among all matches. */
  start: number;
  /** Keyset cursors: the first and last problem number on this page, when there is more that way. */
  prev: number | null;
  next: number | null;
}

/** Keyset pagination by problem number: `after` for the next page, `before` for the previous one. */
export async function listProblems(
  db: Db,
  viewerId: string | null,
  filters: ProblemFilters,
  cursor: { after?: number; before?: number } = {},
  limit = PAGE_SIZE,
): Promise<ProblemPage> {
  const where = filterConditions(filters, viewerId);
  const backwards = cursor.before !== undefined;
  const page = [...where];
  if (cursor.after !== undefined) page.push(gt(problem.number, cursor.after));
  if (backwards) page.push(lt(problem.number, cursor.before!));

  const [raw, [totalRow]] = await Promise.all([
    db
      .select(rowFields)
      .from(problem)
      .leftJoin(userProblem, joinViewer(viewerId))
      .where(and(...page))
      .orderBy(backwards ? desc(problem.number) : asc(problem.number))
      .limit(limit + 1),
    db
      .select({ n: count() })
      .from(problem)
      .leftJoin(userProblem, joinViewer(viewerId))
      .where(and(...where)),
  ]);

  const more = raw.length > limit;
  const rows = raw.slice(0, limit).map((r) => ({ ...r, status: r.status ?? 'todo' }) as ProblemRow);
  if (backwards) rows.reverse();
  const first = rows[0]?.number ?? null;
  const last = rows.at(-1)?.number ?? null;
  const startedMidway = cursor.after !== undefined;
  let start = 0;
  if (first !== null && (startedMidway || backwards)) {
    const [before] = await db
      .select({ n: count() })
      .from(problem)
      .leftJoin(userProblem, joinViewer(viewerId))
      .where(and(...where, lt(problem.number, first)));
    start = before?.n ?? 0;
  }
  return {
    rows,
    total: totalRow?.n ?? 0,
    start,
    prev: backwards ? (more ? first : null) : startedMidway ? first : null,
    next: backwards ? last : more ? last : null,
  };
}

export async function listTags(db: Db): Promise<Array<{ tag: string; n: number }>> {
  return db
    .select({ tag: problemTag.tag, n: count() })
    .from(problemTag)
    .innerJoin(problem, eq(problem.id, problemTag.problemId))
    .where(eq(problem.status, 'published'))
    .groupBy(problemTag.tag)
    .orderBy(desc(count()), asc(problemTag.tag));
}

export interface Progress {
  solved: number;
  total: number;
  byDifficulty: Record<Difficulty, { solved: number; total: number }>;
}

export async function viewerProgress(db: Db, viewerId: string | null): Promise<Progress> {
  const rows = await db
    .select({
      difficulty: problem.difficultyDisplay,
      total: count(),
      solved: sql<number>`sum(case when ${userProblem.status} = 'solved' then 1 else 0 end)`,
    })
    .from(problem)
    .leftJoin(userProblem, joinViewer(viewerId))
    .where(eq(problem.status, 'published'))
    .groupBy(problem.difficultyDisplay);
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, { solved: 0, total: 0 }]),
  ) as Progress['byDifficulty'];
  for (const r of rows)
    byDifficulty[r.difficulty] = { solved: Number(r.solved ?? 0), total: r.total };
  const sum = (k: 'solved' | 'total') => DIFFICULTIES.reduce((n, d) => n + byDifficulty[d][k], 0);
  return { solved: sum('solved'), total: sum('total'), byDifficulty };
}

/** A random problem matching the filters, unsolved ones first. */
export async function randomProblem(
  db: Db,
  viewerId: string | null,
  filters: ProblemFilters,
): Promise<string | null> {
  const [row] = await db
    .select({ slug: problem.slug })
    .from(problem)
    .leftJoin(userProblem, joinViewer(viewerId))
    .where(and(...filterConditions(filters, viewerId)))
    .orderBy(sql`case when ${userProblem.status} = 'solved' then 1 else 0 end`, sql`random()`)
    .limit(1);
  return row?.slug ?? null;
}

/** Parses list filters from URL search params, dropping anything unrecognised. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ProblemFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 100) || undefined;
  };
  const difficulty = one('difficulty');
  const status = one('status');
  return {
    q: one('q'),
    difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty ?? '')
      ? (difficulty as Difficulty)
      : undefined,
    tag: one('tag'),
    status: (STATUSES as readonly string[]).includes(status ?? '')
      ? (status as SolveStatus)
      : undefined,
  };
}

export function filtersToParams(f: ProblemFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of ['q', 'difficulty', 'tag', 'status'] as const) if (f[k]) p.set(k, f[k]!);
  return p;
}
