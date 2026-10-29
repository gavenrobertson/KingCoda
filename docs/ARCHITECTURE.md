# KingCoda — Architecture

Status: **Approved 2026-10-29** · Last updated 2026-10-29

KingCoda is a competitive-programming practice platform: LeetCode's structure, Duolingo's motivation loop, Linear's polish. This document covers the system design, data model, judge, content pipeline, reward loop and security model. The phased plan is in [`ROADMAP.md`](./ROADMAP.md). The visual language (the "Night Court" palette from the KingCoda design canvas) is in [`DESIGN.md`](./DESIGN.md).

Decisions marked **⚑ DECISION** are expensive to reverse. All recommendations in [§13](#13-decisions-needed-from-you) were approved on 2026-10-29.

---

## 1. Goals and non-goals

**Goals**

- Solving a problem feels like winning. Feedback is instant, success is celebrated and progress is visible.
- The judge is secure enough to run hostile code from anyone.
- One problem definition works in every supported language automatically.
- Content scales to 1,000+ problems through a generate-then-validate pipeline. Nothing is copied from other sites.
- Everything runs on Cloudflare: one bill, one deploy tool (`wrangler`), global edge latency.

**Non-goals for v1**

- Interview-style live collaboration or pair-programming rooms.
- Paid subscriptions and premium problems. The schema leaves room for them; billing is out of scope.
- Mobile code editing. Browsing, profile, leaderboards and discussion are fully responsive. The editor says it's best on desktop and saves your place.

---

## 2. System overview

```
                    ┌───────────────────────────── Cloudflare ─────────────────────────────┐
                    │                                                                       │
 Browser ──HTTPS──▶ │  web  (Worker: Next.js App Router via OpenNext)                       │
  Monaco            │   ├─ RSC pages, route handlers, server actions                        │
  Framer Motion     │   ├─ Better Auth (GitHub, Google OAuth)                               │
  WebSocket ◀──────▶│   ├─ Rate Limiting binding (per-user / per-IP)                         │
                    │   ├─ D1  (primary relational DB, Drizzle ORM)                          │
                    │   ├─ KV  (hot read caches: problem list pages, leaderboard pages)      │
                    │   ├─ R2  (submission source, test data, recap images, avatars)         │
                    │   ├─ DO  UserHub      (per-user WebSocket: verdicts, toasts, XP ticks) │
                    │   ├─ DO  ContestRoom  (live scoreboard, per contest)                   │
                    │   └─ Queue producer ──▶ judge-jobs / judge-jobs-contest               │
                    │                                   │                                   │
                    │  judge  (Worker)  ◀───────────────┘ queue consumer                     │
                    │   ├─ DO  JudgePool   (assigns jobs to idle boxes, keeps N warm)        │
                    │   ├─ Container JudgeBox × N  (VM per box, internet OFF)               │
                    │   │     └─ kc-run (trusted runner, root) → user code (uid 2000,       │
                    │   │        rlimits + seccomp + wall timeout + output cap)             │
                    │   └─ verdict: compares outputs in the Worker (expected never enters    │
                    │      the box) → D1 write → game engine → UserHub push                 │
                    │                                                                       │
                    │  cron  (Cron Triggers)  daily challenge rollover, rank snapshots,     │
                    │                          weekly recap generation, streak sweeps       │
                    │  workflows  (Workflows) contest finalisation: standings → Elo →       │
                    │                          plagiarism scan → rating publish             │
                    └───────────────────────────────────────────────────────────────────────┘

 GitHub Actions: lint · typecheck · Vitest · Playwright · content validation (judge image in Docker)
```

### 2.1 Why this shape

| Concern | Choice | Why |
|---|---|---|
| Web framework | Next.js 16 App Router on Workers via **OpenNext** (`@opennextjs/cloudflare`) | Matches your brief, supports RSC, server actions, ISR and middleware. Cloudflare now *recommends* vinext for new apps, but vinext is still beta. OpenNext runs real Next.js. **⚑ DECISION D2** |
| Database | **D1** (SQLite) + **Drizzle ORM** | Native to Cloudflare, no connection management, 30-day point-in-time recovery. A 10 GB cap per DB is ample once source code lives in R2 (see §4.4). Drizzle supports D1 more completely than Prisma. **⚑ DECISION D1** |
| Redis replacement | Leaderboards: D1 indexed tables + KV page cache. Rate limiting: Rate Limiting binding. Queue: **Cloudflare Queues**. Realtime: **Durable Objects** (WebSocket hibernation). | Each Redis job has a first-party Cloudflare equivalent. Sorted sets become indexed `ORDER BY points DESC` queries, which hold up to roughly 100k ranked users (§7.2). |
| Judge | **Cloudflare Containers** running our own runner (`kc-run`) | VM-level isolation per box, outbound internet off, scale to zero, active-CPU pricing. A spike in Phase 1 de-risks it (§5.7). **⚑ DECISION D3** |
| Auth | **Better Auth** with the D1/Drizzle adapter | Auth.js joined the Better Auth project in 2025. Better Auth is the maintained path, runs on Workers, and supports OAuth, magic links, sessions and an admin role. **⚑ DECISION D4** |
| Long jobs | **Workflows** | Contest finalisation and bulk re-judge need durable, retryable, multi-step execution. |
| Images | Satori (`workers-og`) → PNG in R2 | Shareable weekly recap card rendered at the edge. |

### 2.2 Repository layout (pnpm + Turborepo monorepo)

```
apps/
  web/                 Next.js app (OpenNext → Worker "kingcoda-web")
  judge/               Worker "kingcoda-judge": queue consumer, JudgePool DO, JudgeBox container class
packages/
  db/                  Drizzle schema, migrations, typed query helpers
  ui/                  KingCoda design tokens + shadcn/ui components themed to Night Court
  problem-schema/      Zod schema for problem packages + generated JSON Schema
  harness/             Per-language harness generators from typed signatures
  game/                Pure functions: XP, levels, points, gold, streaks, badges, Elo (heavily unit-tested)
  judge-protocol/      Types shared by web ↔ judge ↔ kc-run (job, result, verdict)
judge-image/
  Dockerfile           Debian trixie + Python 3.13, Node 24, TS (swc), Java 21, g++ 14, Go 1.25
  kc-run/              Trusted runner (Go): compile, run, rlimits, seccomp, rusage, output caps
content/
  problems/<slug>/     One directory per problem (see §6)
  tracks/, plans/      Track and study-plan definitions (YAML)
tools/
  pipeline/            generate · validate · dedupe · publish CLIs
docs/                  This file, ROADMAP.md, DESIGN.md, ADRs
```

### 2.3 Local development

Docker Compose is replaced by the Cloudflare toolchain. It emulates every binding we use:

- `pnpm dev` runs `wrangler dev` for **web** and **judge**. Miniflare emulates D1, KV, R2, Queues, DOs and Cron locally.
- `wrangler dev` runs the **JudgeBox** container in local Docker from `judge-image/Dockerfile`.
- `pnpm db:migrate:local` and `pnpm seed` load the problem bank into local D1/R2.
- A `docker compose` file is kept only for running `tools/pipeline validate` against the judge image in CI and on machines without wrangler.

**Known gap:** a local container is not identical to a deployed one. For example, the hostname differs and capabilities can differ. Security behaviour of the judge is therefore tested against a **deployed** staging box, not only locally.

---

## 3. Frontend

- **Next.js App Router + TypeScript**, Tailwind v4 with tokens from `packages/ui`, shadcn/ui primitives restyled to Night Court, Framer Motion for reward animations.
- **Fonts**: Bricolage Grotesque (display, numbers that matter), Geist (UI and problem text), JetBrains Mono (code, stats, shortcuts). All are self-hosted via `next/font` to avoid layout shift.
- **Monaco** loads lazily on the workspace route only, with web workers bundled. Theme tokens come from the equipped editor theme (Midnight Ink by default; Store themes such as Aurora and Parchment).
- **Rendering strategy**
  - Problem list: RSC with KV-cached first page. Filtering and pagination run in a client island against `/api/problems?cursor=…`. Keyset pagination keeps scrolling fast over thousands of rows. An index of ~2,000 problems (~150 KB gzipped) is prefetched to make search and filters instant on the client.
  - Workspace: the statement is server-rendered. The editor, console and verdict panel are client components. Drafts autosave to `localStorage` on every keystroke (debounced at 300 ms) and sync to D1 every 5 s or on blur, per problem per language.
  - Optimistic UI: Run/Submit shows "Judging…" instantly. The verdict arrives over the UserHub WebSocket, with polling as a fallback.
- **Markdown**: `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-sanitize` (strict allowlist) + Shiki for code blocks. A custom `:::spoiler` directive provides discussion spoilers. User Markdown is rendered and sanitised **on the server**.
- **Keyboard**: `Ctrl/⌘+Enter` runs, `Ctrl/⌘+Shift+Enter` submits, `Ctrl/⌘+K` opens the command palette (search problems, jump to pages), `?` shows the shortcut sheet. Everything is reachable by Tab, with visible focus rings in violet-light (`#A79BFF`).
- **Reduced motion**: `prefers-reduced-motion` disables the confetti and particle bursts and replaces them with a static gold glow. XP counters jump straight to the final value. Sound is **off by default**, opt-in in settings, and never plays under reduced motion.

---

## 4. Data model (D1 / Drizzle)

IDs are ULIDs (sortable, generated in the Worker). Timestamps are integer ms. Days are `YYYY-MM-DD` strings in the **user's** time zone where streaks are concerned.

### 4.1 Identity & profile

| Table | Key columns |
|---|---|
| `user`, `account`, `session`, `verification` | Better Auth standard tables (+ `role`: user / moderator / admin) |
| `profile` | `user_id` PK, `handle` unique, `display_name`, `tz`, `main_lang`, `xp`, `level`, `gold`, `points_all_time`, `rating`, `rating_peak`, `streak_current`, `streak_best`, `streak_last_day`, `freezes_held`, `sound_on`, `reduced_motion_pref`, `equipped` (JSON: theme, frame, banner, fx, flame, title) |
| `follow` | `follower_id`, `followee_id` (friends leaderboard = mutual or one-way follow) |

### 4.2 Problems & content

| Table | Key columns |
|---|---|
| `problem` | `id`, `number` (stable display number), `slug` unique, `title`, `difficulty` (authored), `difficulty_display` (calibrated), `tags` (JSON) + `problem_tag` join for filtering, `status` (draft/published/retired), `version`, `license`, `source`, `accepted_count`, `submission_count`, `acceptance_rate`, `median_attempts`, `is_premium` (reserved) |
| `problem_content` | `problem_id`, `version`, `statement_md`, `constraints_md`, `examples` (JSON), `hints` (JSON, tiered with unlock thresholds), `signature` (JSON), `starter_code` (JSON per language), `editorial_md`, `reference_solutions` (JSON per language, served only after solve/reveal) |
| `test_set` | `problem_id`, `version`, `kind` (sample/hidden), `r2_key`, `count`, `checksum`. Test **inputs and expected outputs live in R2**, never in client bundles |
| `track`, `track_problem` | Company-style "track" lists (e.g. "Interview Classics", "Speed Round") |
| `study_plan`, `study_plan_item` | Ordered curated plans with sections |
| `problem_fts` | FTS5 virtual table over title + tags + statement for search |

### 4.3 Practice state

| Table | Key columns |
|---|---|
| `user_problem` | `user_id`+`problem_id` PK, `status` (todo/attempted/solved), `attempts`, `wrong_streak` (drives hint unlocks), `first_accepted_at`, `first_try` (bool), `best_runtime_ms`, `best_memory_kb`, `langs_solved` (bitmask), `editorial_revealed_at`, `hints_revealed` |
| `draft` | `user_id`, `problem_id`, `lang`, `code`, `updated_at` |
| `activity_day` | `user_id`, `day`, `submissions`, `accepted`, `freeze_used` → heatmap + streak source of truth |

### 4.4 Submissions & judging

| Table | Key columns |
|---|---|
| `submission` | `id`, `user_id`, `problem_id`, `problem_version`, `lang`, `mode` (run/submit/contest/virtual), `contest_id?`, `status` (queued/running/done/error), `verdict` (AC/WA/TLE/MLE/RE/CE/IE), `passed`, `total`, `runtime_ms` (max CPU over tests), `memory_kb` (max RSS), `code_r2_key`, `code_hash`, `code_bytes`, `fail_case` (JSON: only for **sample** tests, plus a truncated diff), `compile_log` (truncated), `created_at`, `judged_at` |
| `perf_histogram` | `problem_id`, `lang`, `metric` (runtime/memory), `bucket`, `count` → runtime/memory percentile and the distribution chart. Updated incrementally on each accepted submission |

Source code goes to R2 (`subm/{yyyy}/{mm}/{id}`), not D1. That keeps D1 well under its 10 GB cap for millions of submissions. If D1 does outgrow it, `submission` is the one table built to shard by month into separate D1 databases. No other table needs to.

### 4.5 Game layer

| Table | Key columns |
|---|---|
| `ledger` | Append-only reward events: `user_id`, `kind` (solve/first_try/daily/streak_bonus/contest/purchase/admin), `xp`, `points`, `gold`, `ref`, `week_key`, `month_key`, `created_at`. **Every** balance is derivable from the ledger, so balances can be audited and rebuilt |
| `board` | Materialised leaderboard rows: `scope` (all/week/month/lang:py/…), `period_key`, `user_id`, `points`, `solved`, `updated_at`. Index `(scope, period_key, points DESC, updated_at)` |
| `rank_snapshot` | Nightly `(scope, period_key, user_id, rank)` → rank-change arrows |
| `user_badge` | `user_id`, `badge_id`, `earned_at`. Badge **definitions live in code** (`packages/game/badges.ts`) so they are versioned and testable |
| `daily_challenge` | `day` (UTC) PK, `problem_id`. `daily_completion`: `user_id`, `day` |
| `store_item` / `user_item` | Cosmetic catalogue (from the design canvas: editor themes, avatar frames, banners, celebrations, flames, titles, streak freeze) and ownership |
| `recap` | `user_id`, `week_key`, `stats` (JSON), `image_r2_key` |

### 4.6 Contests

`contest` (slug, title, starts_at, duration, status), `contest_problem` (ordinal, points), `contest_registration`, `contest_result` (rank, score, penalty, per-problem JSON), `rating_change` (old, new, delta, performance), `plagiarism_flag` (pair, similarity, status).

### 4.7 Community & moderation

`thread`, `post` (markdown, `parent_id`, `is_solution`, `lang`), `vote`, `report`, `community_solution` (post with code + upvotes), `moderation_action`, `audit_log` (every admin write).

---

## 5. The judge

### 5.1 Requirements → mechanisms

| Requirement | Mechanism |
|---|---|
| Untrusted code can't escape | Each **JudgeBox is its own VM** (Cloudflare Container). Inside the VM, user code runs as uid 2000 with no capabilities (default scheduling policy; to be verified in the spike, §5.7) under a seccomp allowlist |
| No network | `enableInternet = false`, no `allowedHosts` and no outbound handlers. DNS lookups time out |
| CPU / memory / time limits | `setrlimit` RLIMIT_CPU (hard kill), RLIMIT_AS / maxrss check (MLE), RLIMIT_NPROC (fork bombs), RLIMIT_FSIZE, RLIMIT_NOFILE, RLIMIT_CORE=0; wall-clock watchdog at 2× CPU limit → SIGKILL of the whole process group |
| Output size caps | stdout and stderr are read through a capped pipe (64 KB per test for comparison, 8 KB for display). Exceeding the cap → "Output Limit Exceeded", shown as WA with an explanation |
| Read-only filesystem | Image files are root-owned and not writable by uid 2000. User code can write only to `/work/<job>`, which is wiped after each job |
| Hidden tests never leak | **Expected outputs never enter the box.** The judge Worker streams test inputs in, gets raw outputs back and compares them itself. Hidden-test inputs and outputs are never stored on the submission, sent to the client or logged |
| Assume hostile | One job at a time per box. A box is **recycled** (destroyed and cold-started fresh) after any RE/TLE/MLE/OLE verdict or every 50 jobs, whichever comes first |

### 5.2 Flow

1. **web** `POST /api/submissions` → auth → rate limit (Rate Limiting binding: 6 submits/min and 20 runs/min per user; stricter for new accounts) → code stored in R2 → `submission` row (`queued`) → message to `judge-jobs` (or `judge-jobs-contest` during contests, which has its own reserved boxes).
2. **judge** queue consumer → `JudgePool` DO picks an idle `JudgeBox` (or cold-starts one). The pool has a configurable warm floor: 0 by default (scale to zero; opening a problem pre-warms a box), raised for contests or more users (§5.6).
3. The box's **kc-run** receives `{lang, source, harness, limits, inputs[]}` over the container's local HTTP port.
   - It **compiles** (if needed) as uid 2000 with its own limits (10 s CPU, 1 GiB) → CE with a truncated log.
   - It **runs** each test as uid 2000: fork → `setsid` → rlimits → `PR_SET_NO_NEW_PRIVS` → seccomp → `setuid` → `execve`. It measures CPU time and max RSS via `wait4` rusage. The parent is trusted root, so user code cannot forge the timings.
   - It streams `{output, cpu_ms, rss_kb, exit, signal}` per test back to the Worker.
4. **judge** Worker compares against expected outputs using the problem's checker: exact (default, whitespace-normalised), float with tolerance, unordered collections, or a custom checker function run in the Worker. It stops at the first failure for Submit.
5. It writes the verdict to D1, updates `perf_histogram`, runs the **game engine** (§7) and pushes a `verdict` event (+ `xp`, `badge`, `streak` events) to the user's **UserHub** DO, which forwards it over WebSocket.

Time limits are per problem, **per language**: a base limit × a language multiplier (C++ 1×, Go 1.2×, Java 2×, JS/TS 2.5×, Python 4×), calibrated by the pipeline (§6.4).

### 5.3 Languages (minimum set)

| Language | Toolchain | Notes |
|---|---|---|
| Python | CPython 3.13 | `-S -B`, no site-packages beyond the stdlib allowlist |
| JavaScript | Node 24 | `--max-old-space-size` tied to the memory limit |
| TypeScript | Node 24 + swc transpile-only | Type errors are not CE (matches common judges); syntax errors are |
| Java | OpenJDK 21 | Class-data-sharing archive pre-built for fast JVM start; `-Xmx` from the limit |
| C++ | g++ 14, `-O2 -std=c++20` | Precompiled `bits/stdc++.h` header |
| Go | Go 1.25 | Build cache pre-warmed in the image; `GOMEMLIMIT` set |

The image is ~2.5 GB, which fits a custom instance with 1 vCPU, 3 GiB memory and 12 GB disk.

### 5.4 Language-agnostic I/O

A problem declares a **typed signature**:

```yaml
signature:
  kind: function            # or: design (class with method-call sequences)
  name: longestCalm
  params:
    - { name: speeds, type: "int[]" }
    - { name: k,      type: int }
  returns: int
```

Supported types are `int`, `long`, `double`, `bool`, `string`, `char`, `T[]`, `T[][]`, `ListNode`, `TreeNode`, `GraphAdj` (adjacency list) and `NaryNode`. `packages/harness` generates, per language:

- **starter code** with an idiomatic name (`longest_calm` in Python, `longestCalm` in JS/Java/Go, `longestCalm` in C++),
- a **driver** that reads one JSON test case per line from stdin, deserialises it into native types (building linked lists and trees from level-order arrays), calls the user's function, serialises the result to canonical JSON and prints it.

Design problems (`kind: design`) take `["ClassName","method",…]` / `[[args],…]` sequences, like the familiar operations-log format. One problem package therefore works in every language with no per-language test data.

### 5.5 Runtime & memory percentiles

On each Accepted, `perf_histogram` increments the bucket for (problem, lang, metric). "Beats X%" is the cumulative share of submissions slower than yours. The chart is the bucket distribution, with your bucket in gold, as in the Workspace artboard. Timings come from CPU time, not wall time, which keeps them steady on shared vCPUs. Percentiles are only shown once a bucket set has ≥ 30 accepted submissions; before that the UI says "Not enough data yet".

### 5.6 Cost sketch (Workers Paid plan, $5/mo base)

**Personal use (the default config).** The warm floor is **0**: a box starts on your first Run, stays up while you work and sleeps after 10 minutes idle. You pay only while it's awake. The $5 plan includes 25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk each month. One hour of practice a day keeps a 1 vCPU / 3 GiB box awake about 40 h a month: about $0.30 of extra memory, disk within the included amount and CPU well inside it. **Expected total: about $5–6/mo.** D1, KV, R2 and Queues stay inside their included tiers at this scale.

The trade-off is a cold start of a few seconds on the first Run of a session; every Run after that is fast. The pool opens the box in the background when you open a problem, so most of the time the box is ready before you press Run.

**If it ever grows** (friends, public launch): set the warm floor to 1–2 boxes for instant first runs (≈ $20/mo per always-warm box) and add contest scale-up. It's a config change, not a redesign.

### 5.7 Phase 1 judge spike (go/no-go)

Before the judge is built, a throwaway spike checks these on a **deployed** container:

1. A non-root uid really has no capabilities and cannot write root-owned paths.
2. Seccomp filters install via `PR_SET_NO_NEW_PRIVS` as an unprivileged process.
3. `wait4` rusage gives stable CPU-time numbers (variance < 10% across 50 runs).
4. A fork bomb, a memory bomb, an infinite loop, `/dev/urandom` floods and socket attempts are all contained.
5. Cold start of the full image is under 5 s, and warm job latency is under 300 ms overhead.

If (1) or (2) fails, we fall back to **one box per submission**: a VM per job, restored from a snapshot, with the VM as the only boundary. That is more expensive but still secure. If cold-start or cost is unacceptable, **Option B** is a self-hosted Judge0/isolate pool on a VPS behind the same `judge-protocol` (§13, D3).

---

## 6. Problem content pipeline

### 6.1 Package format

```
content/problems/longest-calm-stretch/
  problem.yaml          # id, slug, title, difficulty, tags, signature, limits, checker, license, source, hints[]
  statement.md          # Markdown + KaTeX, examples are referenced from problem.yaml
  editorial.md          # intuition → brute force → optimal → complexity
  solutions/
    reference.{py,js,ts,java,cpp,go}
    brute.py            # deliberately slow, obviously correct
  gen.py                # deterministic test generator: gen(seed, size_class) → JSON case
  tests/manual.jsonl    # hand-written edge cases (optional)
```

`problem.yaml` is validated by the Zod schema in `packages/problem-schema`. That schema also emits JSON Schema for editors and for the generation step.

### 6.2 Licensing

All KingCoda problems are **original**. Statements and editorials are **CC BY-SA 4.0** (as shown in the Workspace artboard); reference code is **MIT**. A problem adapted from a permissively licensed source must name that source and its licence in `problem.yaml`, and the build fails if `license` is missing. **No content from LeetCode or any other judge site.** Classic algorithmic ideas are fine, but statements, stories, names and test data are written from scratch. The KingCoda style uses a royal/courtly framing (Twin Coins, Castle Gate Intervals, Moat Water Volume), which also keeps wording visibly distinct.

### 6.3 Generation

`tools/pipeline generate --topic sliding-window --difficulty medium --count 10`

- Covers a matrix of 22 topics × 3 difficulties with target mix **35% Easy / 45% Medium / 20% Hard**.
- Uses the **Claude API** to draft complete packages (statement, signature, hints, editorial, solutions in all languages, brute force, generator). The prompt carries the schema, the style guide and the list of existing titles and concepts, which steers it away from duplicates.
- Drafts land in `content/drafts/` and must pass validation **and** a human review (a PR per batch) before moving to `content/problems/`.
- **Default: no API bill.** Drafts are written in Claude Code sessions (like this one) on your existing subscription; the pipeline only validates and publishes them. An optional `--api` mode calls the Claude API for unattended bulk batches, which needs an API key and is billed per token (**⚑ DECISION D6**).

### 6.4 Validation (the build fails if any step fails)

Each step runs in the **same judge image** used in production:

1. **Schema**: the package parses; all languages have a reference solution; licence is present.
2. **Examples**: the reference passes every example in `problem.yaml`.
3. **Generator coverage**: generated tests must include empty/min-size, max-size, all-equal, duplicates, negatives (if the domain allows) and sorted/reverse-sorted cases. Each size class is tagged, and the validator asserts every required class is present.
4. **Constraint check**: every test input satisfies the declared constraints, using an auto-generated validator from the constraints block plus an optional `validate.py`.
5. **Brute force agreement**: reference and brute force agree on ≥ 300 random small inputs.
6. **Cross-language agreement**: every reference solution produces byte-identical canonical output on the full suite.
7. **Complexity gate**: the optimal solution passes max-size tests within the time limit with ≥ 2× headroom, and the brute force **exceeds** it. That proves the limit actually tests complexity. This step also calibrates per-language limits.
8. **Determinism**: two runs of the generator with the same seed produce identical suites.
9. **Near-duplicate detection**: MinHash over normalised statement shingles, plus a signature/tags/solution-AST fingerprint, against all existing problems. A score above the threshold fails, with the closest match named.
10. **Lint**: Markdown/KaTeX renders, hint tiers are ordered, the editorial has the required sections and starter code compiles.

`tools/pipeline publish` uploads test sets to R2 and upserts `problem` and `problem_content` rows (versioned). It runs in CI on merge to `main`.

### 6.5 Difficulty calibration

Nightly job: once a problem has ≥ 200 attempts, `difficulty_display` is nudged from acceptance rate and median attempts-to-AC. Bands are tuned on the first ~150 problems. The authored difficulty is kept for history. A display change > 1 band needs admin approval.

---

## 7. Reward loop & game engine

All rules live in `packages/game` as pure functions with unit tests. The judge calls one entry point, `onVerdict(state, event) → { ledgerEntries[], badgeUnlocks[], uiEvents[] }`, inside a single D1 `batch()`, so reward state can't half-apply.

### 7.1 Currencies

| | Earned | Spent / used | Visible |
|---|---|---|---|
| **XP** (never decreases) | Easy 10 / Medium 25 / Hard 50 on **first** accept per problem; first-try +50%; daily +15; streak milestones | — | Level bar in nav |
| **Points** (leaderboards) | Same base as XP + first-try bonus + daily bonus; contest points separately | — | Leaderboards |
| **Gold** (cosmetics) | Matches the Store artboard: Easy +10, Medium +25, Hard +50, daily +15, 7-day streak +50; first accept per problem only (no farming) | Store cosmetics, streak freeze (150, max 2 held) | Gold chip in nav |

**Levels**: `xpForLevel(L) = round(C·(L−1)²)` with C ≈ 15, so Level 15 ≈ 3,000 XP, as in the design (Lv 14 · 2,375 / 3,000). The curve is tuned in Phase 4.

### 7.2 Leaderboards

- Scopes: all-time, weekly (resets Monday 00:00 CT per the design), monthly, per language, friends.
- Each ledger write upserts `board` rows for all affected scopes. Top pages are cached in KV for 30 s.
- **Own rank**: `SELECT COUNT(*)+1 FROM board WHERE scope=? AND period_key=? AND points > ?`, an index range count that is fast into the low hundreds of thousands of rows. It is always pinned at the bottom of the board, even off-page.
- **Rank-change arrows**: compared with yesterday's `rank_snapshot`.
- Scale path: if `board` reads become hot, move ranking into a `LeaderboardShard` DO with an in-memory order-statistic tree, backed by DO SQLite. The interface stays the same.

### 7.3 Streaks & daily challenge

- A day counts once the user has **any accepted submission** on that calendar day in their own time zone.
- A cron at 00:05 UTC sweeps users whose local day just ended without a solve. If they hold a **freeze**, it is consumed automatically (shown as frost blue in the heatmap); otherwise the streak resets.
- The daily challenge is chosen by a cron from a curated queue, falling back to a rotation that avoids recent topics. It is the same problem worldwide per UTC day.
- The **streak flame** has three growth stages from the design (1–6, 7–29, 30+ days). The Blue Flame cosmetic unlocks at a 30-day streak.

### 7.4 Badges (initial set from the Profile artboard)

First Solve · Week Warrior (7-day) · Monthlong (30) · Centurion (100) · Hard Hitter (first Hard) · Speed Royal (top 10% runtime) · Contender (entered a contest) · Window Washer (15 sliding-window) · Graph Explorer (25 graph) · Calendar Keeper (20 dailies) · Polyglot (solved in 5 languages) · Royal Flush (win a Weekly Crown). Locked badges render as silhouettes with progress ("12/30"). Badges unlock with a toast that can be dismissed or skipped.

### 7.5 Moments

| Moment | Experience |
|---|---|
| Accepted | Particle burst (equipped "celebration" cosmetic; Classic confetti default), skippable with Esc/click, 1.2 s max. XP counter ticks up with a pale-gold gain segment that settles into the bar. Runtime/memory "Beats X%" cards. Personal-best callout when applicable. Optional sound |
| Wrong Answer | Calm, encouraging copy ("47 of 62 passing — close."). Expected vs. actual diff for sample tests; for hidden tests, "a hidden test failed" plus the test *category* (e.g. "edge: all equal") without data. Hint unlocks after N wrong answers (tiered, e.g. 2 / 4 / 6) |
| TLE / MLE | Points at complexity or data structures (verdict tone table in DESIGN.md) |
| CE / RE | Jumps the editor to the offending line; shows the trimmed trace |
| Weekly recap | Monday cron renders a 1080×1350 share card (Recap artboard) to R2. In-app card with Share / Download |

---

## 8. Contests

- **Weekly Crown**: Saturday 9:30 AM CT, 90 minutes, 4 problems of rising difficulty (per the Problems artboard). Problems come from a held-back pool that is never published before the contest.
- **Scoring**: ICPC-style. Solved count first, then penalty = Σ (solve minute + 5 × wrong attempts before AC).
- **Live scoreboard**: the `ContestRoom` DO holds standings in memory (persisted to DO SQLite) and broadcasts deltas over hibernating WebSockets. Standings freeze for the final 10 minutes.
- **Finalisation Workflow**: lock → compute final standings → **plagiarism scan** (token-normalised winnowing per problem and language; pairs above threshold flagged for human review, never auto-penalised) → **Elo-style rating** (Codeforces-like expected rank vs. actual, K decays with contest count, new accounts seeded at 1,500) → publish rating changes.
- **Virtual participation**: replays a past contest with your own clock and ghosts the historic scoreboard at the matching elapsed time. Results are unrated.

---

## 9. Security

| Area | Controls |
|---|---|
| Sandbox | §5.1. The judge Worker treats everything from a box as untrusted input: sizes are capped, JSON is parsed defensively, and the box never sees secrets or expected outputs |
| AuthN/Z | Better Auth sessions (httpOnly, Secure, SameSite=Lax cookies), CSRF protection on mutations, role checks in a single `requireRole()` middleware, and an admin audit log |
| Rate limiting | Rate Limiting binding on submit, run, auth, post, vote; Turnstile on sign-up and on the first post |
| Content | Server-side Markdown → sanitised HTML (allowlist). No raw HTML from users. KaTeX `trust: false`. CSP with nonces; no inline event handlers |
| Hidden tests | Stored only in R2 under a judge-only binding. The web Worker has no read access to hidden test keys (separate bucket + binding) |
| Editorials / reference code | Served only to users who have solved the problem or recorded a reveal |
| Contests | Problems are hidden until start, per-user submission throttles and post-contest plagiarism review |
| Secrets | `wrangler secret` only. Nothing is committed. GitHub Actions uses scoped API tokens |
| Privacy | Account deletion cascades and anonymises leaderboard rows. Data export on request |

---

## 10. Performance budgets

- Navigation: < 100 ms perceived (prefetch on hover/viewport, RSC streaming, skeletons with reserved dimensions, so CLS ≈ 0).
- Problem list API: p95 < 50 ms from KV cache, < 150 ms uncached.
- Run (warm box, Python, samples): p50 < 800 ms submit-to-verdict.
- Editor: Monaco is loaded from the moment the workspace opens; keystroke → paint < 16 ms. No React re-render of the editor on keystrokes (uncontrolled model, debounced autosave).
- JS budget: < 180 KB gzipped on list and profile routes. Monaco is split into its own chunk.

---

## 11. Testing strategy

- **Vitest**: `packages/game` (XP, streaks across time zones and DST, freezes, badges, Elo), `packages/harness` (round-trip serialisation for every type × language), `packages/problem-schema`, route handlers against Miniflare D1.
- **Judge integration**: a hostile-code suite (fork bomb, memory bomb, infinite loop, output flood, network attempt, file-system writes, reading `/proc`, signal tricks) runs against the judge image in CI and against **staging** nightly.
- **Content**: `tools/pipeline validate --all` in CI. Any failure blocks merge.
- **Playwright**: sign-in, browse/filter, solve a problem end-to-end (Run → WA → hint → Submit → AC → XP/badge toast), leaderboard pinning, contest happy path, axe-core accessibility checks on every page, reduced-motion snapshot.
- **Visual**: Playwright screenshots of key states compared against the design canvas.

---

## 12. Observability & ops

Workers Logs + Traces enabled. Workers Analytics Engine records judge latency, queue depth, verdict mix, box recycles and cold starts. These feed the admin stats page. Alerts fire on queue age > 60 s, IE (internal error) rate > 0.5% and box cold-start p95 > 8 s. Deploys go through `wrangler deploy` from CI on `main`, with staging and production environments. D1 Time Travel is the backup (30-day PITR), plus a weekly export to R2.

---

## 13. Decisions needed from you

| # | Decision | Recommendation | Alternatives |
|---|---|---|---|
| **D1** | Primary database | **Cloudflare D1 + Drizzle** | Postgres (Neon/Supabase) via Hyperdrive: more headroom and real `ORDER BY` window functions, but the database lives outside Cloudflare |
| **D2** | Next.js on Workers adapter | **OpenNext** (runs real Next.js, mature) | vinext (Cloudflare's new default, beta); React Router v7 (GA on Workers, not Next.js) |
| **D3** | Judge architecture | **Cloudflare Containers + custom `kc-run`**, gated by the Phase 1 spike | One-VM-per-submission on Containers (stricter, slower, pricier); self-hosted Judge0 on a VPS (proven, not on Cloudflare) |
| **D4** | Auth library | **Better Auth** | Auth.js v5 (your brief; now maintenance-mode under Better Auth) |
| **D5** | Sign-in methods | **GitHub (+ Google) OAuth only** for personal use; no email provider needed | Add email magic links later (Cloudflare Email Service or Resend) |
| **D6** | AI-assisted problem drafting | **Drafted in Claude Code sessions** (no API bill), reviewed per batch | Claude API bulk mode (per-token cost); hand-authoring only |
| **D7** | Store and gold economy from the design canvas | **Include** (cosmetic only; never affects score or rank) in Phase 4–5 | Defer to after Phase 7 |
| **D8** | Content licence | **CC BY-SA 4.0** for text, **MIT** for code | CC BY 4.0; all rights reserved |
| **D9** | Cloudflare account, domain, plan | Workers Paid ($5/mo) is required for Containers; that is roughly the whole bill for personal use (§5.6). Need: account ID and an API token for CI. A custom domain is optional; the free `*.workers.dev` URL works | — |
