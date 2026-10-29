# KingCoda — Roadmap

Status: **Approved 2026-10-29** (all recommendations D1–D9 accepted; personal-use cost profile) · Last updated 2026-10-29 · Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · Design: [`DESIGN.md`](./DESIGN.md)

Every phase ends with: full test suite green, a deployed staging build, and a report of **done / deferred / decisions needed**. Each phase lands as a series of working commits on the development branch. Nothing is left half-wired between commits.

Decision IDs (D1–D9) refer to [ARCHITECTURE §13](./ARCHITECTURE.md#13-decisions-needed-from-you).

---

## Phase 1 — Foundations

_Needs from you before deploy: Cloudflare account ID + API token (D9). D3 is confirmed by the spike in this phase._

- [x] Monorepo scaffold: pnpm, Turborepo, TypeScript strict, ESLint, Prettier, Vitest, Playwright, GitHub Actions CI.
- [x] `packages/ui`: Night Court tokens (dark + derived light), self-hosted fonts, Tailwind v4 theme, contrast check (52 pairs, WCAG AA) in CI. _Primitives are hand-built (Button, chips, XP bar, flame, gold); shadcn/ui comes in Phase 2 with the first dialogs and menus._
- [x] `apps/web` on Workers via OpenNext: app shell (header with gold, streak flame, XP bar, avatar), theme toggle without flash, 404/error states. Verified in workerd (1.6 MiB gzipped).
- [x] `packages/db`: Drizzle schema for identity, problems, submissions, game, contests and community; init migration; CI drift check. _Seed data arrives with the 25 problems in Phase 2._
- [x] Auth: Better Auth with GitHub and Google OAuth (no email provider, per D5); handle onboarding; roles column.
- [x] Wrangler environments (local / e2e / staging / production) for D1, KV, R2. _Queues and Durable Objects are added with the judge in Phase 2._
- [x] **Judge spike**: 32/32 hostile probes contained on a deployed Cloudflare Container (namespace jail + cgroups + seccomp; 6 issues found and fixed). D3 confirmed. See [spike report](./spike/judge-spike.md).
- [x] ADRs recorded for D1–D4 ([`docs/adr/`](./adr/)).

**Exit**: sign in with GitHub on staging, see an empty-state problems page in the KingCoda shell, CI green, and spike report delivered. _Status: met. Production is live at kingcoda-web.gaven-robertson.workers.dev; GitHub sign-in needs an OAuth app (pending from you)._

## Phase 2 — Browse, solve, judge (C++, 25 problems)

_Needs: D3 confirmed by the spike_

- [x] `packages/problem-schema` + `packages/harness` (types: scalars, arrays, 2D arrays, strings, ListNode, TreeNode). _C++ is the only judged language in Phase 2 (decided 2026-10-29); Python and JavaScript drivers are built and tested, and switch on in Phase 3._
- [x] Judge image + `kc-run`: multi-file programs, whole-suite inputs, precompiled C++ prelude (~0.8 s compiles), `-Werror=return-type`; 32 hostile probes + 8 end-to-end verdicts through the box in CI.
- [x] `packages/judge-core`: job building (tests grouped into processes, every process gets the full time limit, public and hidden cases never share one), verdicts AC/WA/TLE/MLE/OLE/RE/CE/IE at the failing case, exact/float/unordered checkers, custom input.
- [x] `apps/judge`: queue consumer, `JudgeBox` Durable Object starting the container, RPC entry point for the web app, verdict + progress write-back, retries then IE, production smoke test in the Deploy workflow. _One box (`box-0`): `JudgePool` with several boxes and a warm floor waits until there are more users. Recycle policy changed: on stray processes and every 200 jobs, not after every failing verdict (a recycle costs a 10–19 s cold start)._
- [ ] UserHub DO: WebSocket push of verdicts. _Deferred to Phase 4 with the reward moments that need it; Phase 2 polls every 0.6 s._
- [x] Problem browser: search (FTS5), difficulty/topic/status filters, keyset pagination, "Pick one for me", progress sidebar, designed empty and error states. _Track filter arrives with tracks in Phase 5._
- [x] Workspace: resizable split, sanitized Markdown + KaTeX statement, examples, constraints, hints that unlock after wrong answers, Monaco (served from our own origin), starter code, autosave, custom input, Run vs. Submit, Ctrl+Enter / Ctrl+Shift+Enter, test console, verdict panel with example diff, submission history, mobile "bigger screen" card. _Language picker shows C++ only until Phase 3._
- [x] 25 hand-written seed problems (9 Easy, 11 Medium, 5 Hard) in the package format, validated by pipeline v0; `kc-pipeline publish` versions them into D1 + R2.
- [x] Rate limiting on run/submit (6 submits, 20 runs a minute per user).

**Exit**: a user can find a problem, fail it, read the diff, fix it and get Accepted (C++). The hostile suite passes on a deployed box. _Status: the journey is a Playwright test against the real sandbox in CI; production deploy via the Deploy workflow. There is no separate staging environment (personal use)._

## Phase 3 — Content pipeline, 150 problems, more languages

- [ ] Turn on Python and JavaScript; add TypeScript, Java and Go; design-problem (`kind: design`) support.
- [ ] `tools/pipeline validate` with all 10 checks (ARCHITECTURE §6.4), including the brute-force-must-TLE complexity gate and per-language limit calibration. _Needed: Phase 2 found Twin Coins accepting an O(n²) solution until its largest tests were made adversarial; the other 24 problems need the same gate._
- [ ] Near-duplicate detector (MinHash + structural fingerprint).
- [ ] Drafting workflow in Claude Code sessions (D6) with drafts → review PR → publish; optional Claude API bulk mode.
- [ ] `tools/pipeline publish` in CI on merge to `main` (the command exists since Phase 2; the Deploy workflow runs it by hand).
- [ ] Editorials for every problem: intuition → brute force → optimal → complexity, plus reference solutions in all 6 languages; locked until solve or reveal (reveals tracked).
- [ ] Runtime/memory percentiles + distribution chart.
- [ ] **150 validated problems** at ~35/45/20 across the topic matrix; tracks seeded.

**Exit**: `pipeline validate --all` green on 150 problems × 6 languages in CI.

## Phase 4 — Profiles, XP, streaks, badges, reward moments

_Store included (D7 approved)_

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
