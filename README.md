# KingCoda

A competitive programming practice platform where solving a problem feels like winning. It runs on Cloudflare: Workers, D1, R2, KV, Queues, Durable Objects and Containers.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design, data model, judge, content pipeline, reward loop, security
- [`docs/ROADMAP.md`](docs/ROADMAP.md): phased plan with exit criteria
- [`docs/DESIGN.md`](docs/DESIGN.md): the Night Court design tokens from the KingCoda design canvas

## Layout

| Path            | What                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `apps/web`      | Next.js App Router on Cloudflare Workers (OpenNext), Better Auth           |
| `packages/ui`   | Design tokens (single source in `src/tokens.ts`), theme CSS, UI components |
| `packages/db`   | Drizzle schema for D1 and its SQL migrations                               |
| `packages/game` | Pure reward-loop rules (levels so far; XP, streaks and badges in Phase 4)  |
| `judge-spike`   | Phase 1 judge sandbox prototype (`kc-run`) and its hostile-code test suite |

## Local development

Requires Node 22+ and pnpm 10.

```bash
pnpm install
```

```bash
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" > apps/web/.dev.vars
```

```bash
pnpm --filter @kingcoda/web db:migrate:local
```

```bash
pnpm dev
```

The app runs at http://localhost:3000 with emulated D1, KV and R2 (state lives in `apps/web/.wrangler/`). To sign in locally, create a GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github` and add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `apps/web/.dev.vars` (see `.dev.vars.example`).

## Checks

```bash
pnpm lint && pnpm format:check && pnpm tokens:check && pnpm typecheck && pnpm test
```

```bash
pnpm e2e
```

`pnpm e2e` runs Playwright against a throwaway local database. Where a Chromium is pre-installed instead of Playwright's own, set `PW_CHROMIUM_PATH` to it.

After changing `packages/db/src/schema.ts`, generate a migration with `pnpm --filter @kingcoda/db generate`. After changing `packages/ui/src/tokens.ts`, regenerate the theme with `pnpm --filter @kingcoda/ui build:css`. CI fails if either is forgotten.

## Content licence

All problem content is original (statements and editorials CC BY-SA 4.0, code MIT) unless a problem names a permissively licensed source.
