# ADR 0004 — Better Auth with OAuth only

Status: Accepted 2026-10-29 (D4, D5)

**Context.** Auth.js joined the Better Auth project in 2025 and is in maintenance mode. KingCoda is for personal use first, so email sign-in (and an email provider) isn't needed yet.

**Decision.** Better Auth with its Drizzle adapter on D1; GitHub and Google OAuth. Providers appear only when their secrets are set. A KingCoda `profile` (handle, XP, gold, streak) is created at onboarding. Email/password exists only for Playwright, behind `APP_ENV=local` plus `E2E_PASSWORD_AUTH=1`, which only the `e2e` wrangler environment sets.

**Consequences.** No email bills or deliverability work. Adding magic links later means one plugin plus an email binding.
