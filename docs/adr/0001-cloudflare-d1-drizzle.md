# ADR 0001 — D1 + Drizzle as the primary database

Status: Accepted 2026-10-29 (D1)

**Context.** Hosting is Cloudflare. The app needs relational data (problems, submissions, ledger, leaderboards) with modest write volume at first. It's personal use with room to grow.

**Decision.** Use Cloudflare D1 (SQLite) through Drizzle ORM. Source code and test data go to R2, not D1. Schema lives in `packages/db/src/schema.ts`; drizzle-kit generates migrations into `packages/db/migrations`, which wrangler applies.

**Consequences.** No connection management; 30-day point-in-time recovery; free at this scale. Each database caps at 10 GB and runs single-threaded, so leaderboards use indexed tables plus KV caching, and `submission` is built to shard by month if needed. CI fails if the schema changes without a migration.
