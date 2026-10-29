/**
 * KingCoda D1 schema (SQLite). See docs/ARCHITECTURE.md §4.
 * IDs are ULIDs, timestamps are integer ms (`mode: 'timestamp_ms'`), days are `YYYY-MM-DD`.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export const VERDICTS = ['AC', 'WA', 'TLE', 'MLE', 'OLE', 'RE', 'CE', 'IE'] as const;
export type VerdictCode = (typeof VERDICTS)[number];

// ───────────────────────────── Identity (Better Auth core tables) ─────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  role: text('role', { enum: ['user', 'moderator', 'admin'] })
    .notNull()
    .default('user'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ───────────────────────────── Profile & social ─────────────────────────────

export interface Equipped {
  theme: string;
  frame: string | null;
  banner: string | null;
  fx: string | null;
  flame: string | null;
  title: string | null;
}

export const profile = sqliteTable('profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  handle: text('handle').notNull().unique(),
  displayName: text('display_name').notNull(),
  tz: text('tz').notNull().default('UTC'),
  mainLang: text('main_lang', { enum: LANGUAGES }).notNull().default('python'),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  gold: integer('gold').notNull().default(0),
  pointsAllTime: integer('points_all_time').notNull().default(0),
  rating: integer('rating').notNull().default(1500),
  ratingPeak: integer('rating_peak').notNull().default(1500),
  contestsRated: integer('contests_rated').notNull().default(0),
  streakCurrent: integer('streak_current').notNull().default(0),
  streakBest: integer('streak_best').notNull().default(0),
  streakLastDay: text('streak_last_day'),
  freezesHeld: integer('freezes_held').notNull().default(0),
  soundOn: integer('sound_on', { mode: 'boolean' }).notNull().default(false),
  theme: text('theme', { enum: ['dark', 'light', 'system'] })
    .notNull()
    .default('dark'),
  equipped: text('equipped', { mode: 'json' })
    .$type<Equipped>()
    .notNull()
    .default(
      sql`'{"theme":"midnight","frame":null,"banner":null,"fx":null,"flame":null,"title":null}'`,
    ),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const follow = sqliteTable(
  'follow',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('follow_followee_idx').on(t.followeeId),
  ],
);

// ───────────────────────────── Problems & content ─────────────────────────────

export const problem = sqliteTable(
  'problem',
  {
    id: text('id').primaryKey(),
    number: integer('number').notNull().unique(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull(),
    difficultyDisplay: text('difficulty_display', { enum: DIFFICULTIES }).notNull(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: ['draft', 'published', 'retired', 'contest_hold'] })
      .notNull()
      .default('draft'),
    version: integer('version').notNull().default(1),
    license: text('license').notNull(),
    source: text('source').notNull().default('Original KingCoda problem'),
    acceptedCount: integer('accepted_count').notNull().default(0),
    submissionCount: integer('submission_count').notNull().default(0),
    acceptanceRate: real('acceptance_rate'),
    medianAttempts: real('median_attempts'),
    isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('problem_status_number_idx').on(t.status, t.number),
    index('problem_status_difficulty_idx').on(t.status, t.difficultyDisplay, t.number),
    index('problem_status_acceptance_idx').on(t.status, t.acceptanceRate),
  ],
);

export const problemTag = sqliteTable(
  'problem_tag',
  {
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.problemId, t.tag] }),
    index('problem_tag_tag_idx').on(t.tag, t.problemId),
  ],
);

export interface Example {
  input: Record<string, unknown>;
  output: unknown;
  explanation?: string;
}
export interface Hint {
  tier: number;
  unlockAfterWrong: number;
  text: string;
}

export const problemContent = sqliteTable(
  'problem_content',
  {
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    statementMd: text('statement_md').notNull(),
    constraintsMd: text('constraints_md').notNull(),
    examples: text('examples', { mode: 'json' }).$type<Example[]>().notNull(),
    hints: text('hints', { mode: 'json' }).$type<Hint[]>().notNull(),
    signature: text('signature', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    starterCode: text('starter_code', { mode: 'json' })
      .$type<Partial<Record<Language, string>>>()
      .notNull(),
    limits: text('limits', { mode: 'json' })
      .$type<{ timeMs: number; memoryMb: number }>()
      .notNull(),
    checker: text('checker', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    editorialMd: text('editorial_md').notNull(),
    referenceSolutions: text('reference_solutions', { mode: 'json' })
      .$type<Partial<Record<Language, string>>>()
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.version] })],
);

export const testSet = sqliteTable(
  'test_set',
  {
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    kind: text('kind', { enum: ['sample', 'hidden'] }).notNull(),
    r2Key: text('r2_key').notNull(),
    count: integer('count').notNull(),
    checksum: text('checksum').notNull(),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.version, t.kind] })],
);

export const track = sqliteTable('track', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
});

export const trackProblem = sqliteTable(
  'track_problem',
  {
    trackId: text('track_id')
      .notNull()
      .references(() => track.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.trackId, t.problemId] }),
    index('track_problem_problem_idx').on(t.problemId),
  ],
);

export const studyPlan = sqliteTable('study_plan', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull().default(0),
});

export const studyPlanItem = sqliteTable(
  'study_plan_item',
  {
    planId: text('plan_id')
      .notNull()
      .references(() => studyPlan.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.planId, t.problemId] }),
    index('study_plan_item_order_idx').on(t.planId, t.position),
  ],
);

// ───────────────────────────── Practice state ─────────────────────────────

export const userProblem = sqliteTable(
  'user_problem',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['attempted', 'solved'] }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    wrongStreak: integer('wrong_streak').notNull().default(0),
    firstAcceptedAt: integer('first_accepted_at', { mode: 'timestamp_ms' }),
    firstTry: integer('first_try', { mode: 'boolean' }).notNull().default(false),
    bestRuntimeMs: integer('best_runtime_ms'),
    bestMemoryKb: integer('best_memory_kb'),
    langsSolved: integer('langs_solved').notNull().default(0),
    editorialRevealedAt: integer('editorial_revealed_at', { mode: 'timestamp_ms' }),
    hintsRevealed: integer('hints_revealed').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.problemId] }),
    index('user_problem_status_idx').on(t.userId, t.status),
  ],
);

export const draft = sqliteTable(
  'draft',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    lang: text('lang', { enum: LANGUAGES }).notNull(),
    code: text('code').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.problemId, t.lang] })],
);

export const activityDay = sqliteTable(
  'activity_day',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    submissions: integer('submissions').notNull().default(0),
    accepted: integer('accepted').notNull().default(0),
    freezeUsed: integer('freeze_used', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

// ───────────────────────────── Submissions & judging ─────────────────────────────

export const contest = sqliteTable(
  'contest',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    durationMin: integer('duration_min').notNull(),
    status: text('status', { enum: ['scheduled', 'running', 'finalizing', 'final'] })
      .notNull()
      .default('scheduled'),
  },
  (t) => [index('contest_starts_idx').on(t.startsAt)],
);

/**
 * The judge's verdict detail (packages/judge-core `Verdict`). Holds data from public cases only
 * (examples and custom input); a hidden failure is its position, edge-case label and a fixed message.
 */
export type SubmissionReport = Record<string, unknown>;

export const submission = sqliteTable(
  'submission',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id),
    problemVersion: integer('problem_version').notNull(),
    lang: text('lang', { enum: LANGUAGES }).notNull(),
    mode: text('mode', { enum: ['run', 'submit', 'contest', 'virtual'] }).notNull(),
    contestId: text('contest_id').references(() => contest.id),
    status: text('status', { enum: ['queued', 'running', 'done', 'error'] })
      .notNull()
      .default('queued'),
    verdict: text('verdict', { enum: VERDICTS }),
    passed: integer('passed'),
    total: integer('total'),
    runtimeMs: integer('runtime_ms'),
    memoryKb: integer('memory_kb'),
    codeR2Key: text('code_r2_key').notNull(),
    codeHash: text('code_hash').notNull(),
    codeBytes: integer('code_bytes').notNull(),
    /** Hidden test data is never stored here. */
    report: text('report', { mode: 'json' }).$type<SubmissionReport>(),
    compileLog: text('compile_log'),
    createdAt: createdAt(),
    judgedAt: integer('judged_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('submission_user_problem_idx').on(t.userId, t.problemId, t.createdAt),
    index('submission_user_created_idx').on(t.userId, t.createdAt),
    index('submission_contest_idx').on(t.contestId, t.createdAt),
    index('submission_status_idx').on(t.status, t.createdAt),
  ],
);

export const perfHistogram = sqliteTable(
  'perf_histogram',
  {
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id, { onDelete: 'cascade' }),
    lang: text('lang', { enum: LANGUAGES }).notNull(),
    metric: text('metric', { enum: ['runtime', 'memory'] }).notNull(),
    bucket: integer('bucket').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.lang, t.metric, t.bucket] })],
);

// ───────────────────────────── Game layer ─────────────────────────────

export const ledger = sqliteTable(
  'ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['solve', 'first_try', 'daily', 'streak_bonus', 'contest', 'purchase', 'admin'],
    }).notNull(),
    xp: integer('xp').notNull().default(0),
    points: integer('points').notNull().default(0),
    gold: integer('gold').notNull().default(0),
    ref: text('ref'),
    weekKey: text('week_key').notNull(),
    monthKey: text('month_key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_user_created_idx').on(t.userId, t.createdAt),
    // One solve reward per user per problem: the anti-farming guarantee lives in the DB.
    uniqueIndex('ledger_unique_reward_idx').on(t.userId, t.kind, t.ref),
  ],
);

export const board = sqliteTable(
  'board',
  {
    scope: text('scope').notNull(),
    periodKey: text('period_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    points: integer('points').notNull().default(0),
    solved: integer('solved').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.periodKey, t.userId] }),
    index('board_rank_idx').on(t.scope, t.periodKey, t.points, t.updatedAt),
  ],
);

export const rankSnapshot = sqliteTable(
  'rank_snapshot',
  {
    scope: text('scope').notNull(),
    periodKey: text('period_key').notNull(),
    day: text('day').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.periodKey, t.day, t.userId] })],
);

export const userBadge = sqliteTable(
  'user_badge',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    badgeId: text('badge_id').notNull(),
    earnedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

export const dailyChallenge = sqliteTable('daily_challenge', {
  day: text('day').primaryKey(),
  problemId: text('problem_id')
    .notNull()
    .references(() => problem.id),
});

export const dailyCompletion = sqliteTable(
  'daily_completion',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const userItem = sqliteTable(
  'user_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    acquiredAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

export const recap = sqliteTable(
  'recap',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    weekKey: text('week_key').notNull(),
    stats: text('stats', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    imageR2Key: text('image_r2_key'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekKey] })],
);

// ───────────────────────────── Contests ─────────────────────────────

export const contestProblem = sqliteTable(
  'contest_problem',
  {
    contestId: text('contest_id')
      .notNull()
      .references(() => contest.id, { onDelete: 'cascade' }),
    problemId: text('problem_id')
      .notNull()
      .references(() => problem.id),
    ordinal: integer('ordinal').notNull(),
    points: integer('points').notNull(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.problemId] })],
);

export const contestRegistration = sqliteTable(
  'contest_registration',
  {
    contestId: text('contest_id')
      .notNull()
      .references(() => contest.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    virtualStartAt: integer('virtual_start_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
);

export const contestResult = sqliteTable(
  'contest_result',
  {
    contestId: text('contest_id')
      .notNull()
      .references(() => contest.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    solved: integer('solved').notNull(),
    penalty: integer('penalty').notNull(),
    perProblem: text('per_problem', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.contestId, t.userId] }),
    index('contest_result_rank_idx').on(t.contestId, t.rank),
  ],
);

export const ratingChange = sqliteTable(
  'rating_change',
  {
    contestId: text('contest_id')
      .notNull()
      .references(() => contest.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    oldRating: integer('old_rating').notNull(),
    newRating: integer('new_rating').notNull(),
    performance: integer('performance').notNull(),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.userId] })],
);

export const plagiarismFlag = sqliteTable('plagiarism_flag', {
  id: text('id').primaryKey(),
  contestId: text('contest_id')
    .notNull()
    .references(() => contest.id, { onDelete: 'cascade' }),
  submissionA: text('submission_a').notNull(),
  submissionB: text('submission_b').notNull(),
  similarity: real('similarity').notNull(),
  status: text('status', { enum: ['open', 'cleared', 'confirmed'] })
    .notNull()
    .default('open'),
});

// ───────────────────────────── Community & moderation ─────────────────────────────

export const thread = sqliteTable(
  'thread',
  {
    id: text('id').primaryKey(),
    problemId: text('problem_id').references(() => problem.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind', { enum: ['discussion', 'solution'] })
      .notNull()
      .default('discussion'),
    lang: text('lang', { enum: LANGUAGES }),
    score: integer('score').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('thread_problem_idx').on(t.problemId, t.kind, t.score)],
);

export const post = sqliteTable(
  'post',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => thread.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bodyMd: text('body_md').notNull(),
    bodyHtml: text('body_html').notNull(),
    score: integer('score').notNull().default(0),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('post_thread_idx').on(t.threadId, t.createdAt)],
);

export const vote = sqliteTable(
  'vote',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: ['thread', 'post'] }).notNull(),
    targetId: text('target_id').notNull(),
    value: integer('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const report = sqliteTable('report', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { enum: ['thread', 'post', 'user'] }).notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['open', 'resolved', 'dismissed'] })
    .notNull()
    .default('open'),
  createdAt: createdAt(),
});

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
);
