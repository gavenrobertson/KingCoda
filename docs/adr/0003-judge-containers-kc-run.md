# ADR 0003 — Judge on Cloudflare Containers with kc-run + kc-exec

Status: Accepted 2026-10-29 (D3), pending the deployed spike run

**Context.** Every submission is hostile. The judge must enforce CPU, memory, time and output limits, allow no network and never leak hidden tests, on Cloudflare.

**Decision.** Each judge box is a Cloudflare Container (its own VM) with `enableInternet = false`, running the default scheduling policy. Inside, `kc-run` (Go, root, under tini) supervises and `kc-exec` (C) applies rlimits, drops to uid 2000 and installs seccomp before `execve`. Expected outputs never enter the box; the judge Worker compares outputs. Boxes scale to zero for personal use.

**Consequences.** VM isolation between boxes, three layers inside one box (uid without capabilities, no-new-privs, seccomp), kernel-measured timings. The local spike passes 30/30 hostile probes with timing variation under 1% ([report](../spike/judge-spike.md)). Fallbacks if the deployed run fails: one VM per submission (restore from snapshot), or self-hosted Judge0 behind the same protocol.
