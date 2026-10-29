# KingCoda — Roadmap

Status: **Approved 2026-10-29** (all recommendations D1–D9 accepted; personal-use cost profile) · Last updated 2026-10-29 · Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · Design: [`DESIGN.md`](./DESIGN.md)

Every phase ends with: full test suite green, a deployed staging build, and a report of **done / deferred / decisions needed**. Each phase lands as a series of working commits on the development branch. Nothing is left half-wired between commits.

Decision IDs (D1–D9) refer to [ARCHITECTURE §13](./ARCHITECTURE.md#13-decisions-needed-from-you).

---

## Phase 1 — Foundations
*Needs from you before deploy: Cloudflare account ID + API token (D9). D3 is confirmed by the spike in this phase.*

- [ ] Monorepo scaffold: pnpm, Turborepo, TypeScript strict, ESLint, Prettier, Vitest, Playwright, GitHub Actions CI.
- [ ] `packages/ui`: Night Court tokens (dark + derived light), fonts, Tailwind v4 theme, shadcn/ui primitives restyled; contrast-check script in CI.
- [ ] `apps/web` on Workers via OpenNext: app shell (header with gold chip, streak flame, XP bar, avatar), theme toggle, 404/500 states.
- [ ] `packages/db`: Drizzle schema for identity, problems, submissions, game tables; migrations; local D1 seed.
- [ ] Auth: Better Auth with GitHub and Google OAuth (no email provider, per D5); profile creation with a handle picker; roles.
- [ ] Wrangler environments (local / staging / production) for D1, KV, R2, Queues, DOs.
- [ ] **Judge spike** on a deployed Container (go/no-go checklist in ARCHITECTURE §5.7). Write up findings and settle **D3**.
- [ ] ADRs recorded for D1–D4.

**Exit**: sign in with GitHub on staging, see an empty-state problems page in the KingCoda shell, CI green, and spike report delivered.

## Phase 2 — Browse, solve, judge (3 languages, 25 problems)
*Needs: D3 confirmed by the spike*

- [ ] `packages/problem-schema` + `packages/harness` for Python, JavaScript and C++ (types: scalars, arrays, 2D arrays, strings, ListNode, TreeNode).
- [ ] `judge-image` + `kc-run`: compile/run, rlimits, seccomp, output caps, rusage; hostile-code test suite.
- [ ] `apps/judge`: queue consumer, JudgePool DO (warm floor, recycle policy), JudgeBox container, checker variants, verdict write-back.
- [ ] UserHub DO: WebSocket push of verdicts, with polling fallback.
- [ ] Problem browser: search (FTS5), difficulty/topic/status/track filters, keyset pagination, "Pick one for me", progress sidebar, designed empty and error states.
- [ ] Workspace: resizable split, Markdown + KaTeX statement, examples, constraints, Monaco, language picker, starter code, per-language autosave, custom input, Run vs. Submit, shortcuts, test console, verdict panel with sample-test diff, mobile "bigger screen" card.
- [ ] 25 hand-written seed problems (mixed topics and difficulties) in the package format, validated by an early version of the pipeline.
- [ ] Rate limiting on run/submit.

**Exit**: on staging, a user can find a problem, fail it, read the diff, fix it and get Accepted in Python, JS or C++. The hostile suite passes on a deployed box.

## Phase 3 — Content pipeline, 150 problems, all languages

- [ ] Harness for TypeScript, Java and Go; design-problem (`kind: design`) support.
- [ ] `tools/pipeline validate` with all 10 checks (ARCHITECTURE §6.4), including the brute-force-must-TLE complexity gate and per-language limit calibration.
- [ ] Near-duplicate detector (MinHash + structural fingerprint).
- [ ] Drafting workflow in Claude Code sessions (D6) with drafts → review PR → publish; optional Claude API bulk mode.
- [ ] `tools/pipeline publish` in CI → R2 test sets + versioned D1 content.
- [ ] Editorials for every problem: intuition → brute force → optimal → complexity, plus reference solutions in all 6 languages; locked until solve or reveal (reveals tracked).
- [ ] Runtime/memory percentiles + distribution chart.
- [ ] **150 validated problems** at ~35/45/20 across the topic matrix; tracks seeded.

**Exit**: `pipeline validate --all` green on 150 problems × 6 languages in CI.

## Phase 4 — Profiles, XP, streaks, badges, reward moments
*Store included (D7 approved)*

- [ ] `packages/game`: ledger, XP/levels, points, gold, first-try bonus, streaks with time zones and freezes, badge rules — exhaustively unit-tested.
- [ ] Accepted moment: particle burst (skippable), XP tick-up with gold-flash segment, Beats-X% cards, personal-best callouts, optional sound, full reduced-motion path.
- [ ] WA/TLE/MLE/RE/CE tones; tiered hint unlocks after N failed attempts.
- [ ] Badge unlock toasts; badge gallery with locked silhouettes and progress.
- [ ] Profile page: solved donut by difficulty, heatmap, streak and personal bests, language breakdown, badges, recent activity, rating.
- [ ] Store: catalogue from the canvas, buy/equip, editor themes in Monaco, avatar frames, banners, celebration effects, flames, titles, streak freeze.

**Exit**: Playwright "solve → celebrate → badge → profile updates" journey green, with reduced-motion snapshot.

## Phase 5 — Leaderboards, daily challenge, study plans

- [ ] Leaderboards: all-time, weekly, monthly, by language, friends (follow system); podium; pinned own rank; rank-change arrows from nightly snapshots; KV caching.
- [ ] Daily challenge: cron selection, countdown card, daily bonus, streak integration, freeze auto-consume.
- [ ] Study plans: "Arrays & Hashing 30", "Sliding Window Sprint", "DP from Zero", "Graphs Bootcamp" (+ more), ordered sections and progress bars.
- [ ] Weekly recap: Monday cron, Satori share image to R2, in-app card with Share/Download.

**Exit**: leaderboard correctness tests (ties, period rollover, DST week boundary) green; recap image renders matching the canvas.

## Phase 6 — Contests & rating

- [ ] Contest model, registration, held-back problem pool, start/end gating.
- [ ] ContestRoom DO live scoreboard with penalty time and freeze window.
- [ ] Finalisation Workflow: standings → plagiarism scan → Elo-style rating → publish; rating history chart on profile.
- [ ] Virtual participation with ghost scoreboard.
- [ ] Reserved judge capacity for contests (separate queue, scheduled warm-up).

**Exit**: simulated contest with 500 synthetic participants on staging, scoreboard latency < 1 s, rating changes verified against reference calculations.

## Phase 7 — Community, admin, polish, audits

- [ ] Discussions: per-problem threads, Markdown + code blocks + spoilers, votes, reports.
- [ ] Community solutions with upvotes (unlocked after solve).
- [ ] Admin panel: problem create/edit (form over the package schema), test-case management, re-judge (Workflow), moderation queue, platform stats (Analytics Engine), audit log.
- [ ] Polish pass against the canvas; empty and error states everywhere; skeletons; optimistic UI.
- [ ] Performance audit against the budgets in ARCHITECTURE §10.
- [ ] Accessibility audit: axe in CI, keyboard-only walkthrough, screen-reader pass, contrast report.

**Exit**: Lighthouse ≥ 95 (perf, a11y) on list, profile and leaderboard; zero axe violations; budgets met.

## Phase 8 — Scale content to 1,000+

- [ ] Generation batches by topic × difficulty with review PRs; pipeline throughput work (parallel validation in CI).
- [ ] Difficulty calibration from real data.
- [ ] More tracks and study plans built from the larger bank.

**Exit**: ≥ 1,000 published problems, all passing validation, distribution within ±3% of target.

---

## Deferred / later

Premium content and billing · interview mode · editor collaboration · team/org leaderboards · i18n · native mobile apps.
