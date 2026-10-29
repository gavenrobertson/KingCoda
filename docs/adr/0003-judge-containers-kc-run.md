# ADR 0003 — Judge on Cloudflare Containers with kc-run + kc-exec

Status: Accepted 2026-10-29 (D3). Confirmed on Cloudflare: 32/32 hostile probes contained

**Context.** Every submission is hostile. The judge must enforce CPU, memory, time and output limits, allow no network and never leak hidden tests, on Cloudflare.

**Decision.** Each judge box is a Cloudflare Container (its own microVM) with internet off, started by its Durable Object under the `durable_object` scheduling policy (the only one available to new accounts). Inside, `kc-run` (Go, root, under tini) supervises one job at a time, and `kc-exec` (C) runs each step in a namespace jail: new PID/mount/net/IPC/UTS namespaces, a minimal read-only root via `pivot_root`, a per-step cgroup v2 (memory, pids, kill), rlimits, no-new-privs, and a seccomp filter designed for a process that may hold every capability. Expected outputs never enter the box; the judge Worker compares outputs. Boxes scale to zero for personal use.

**Consequences.** Isolation doesn't depend on uids or capabilities, which Cloudflare's platform doesn't honour. The spike passes 32/32 hostile probes on Cloudflare and locally ([report](../spike/judge-spike.md)). Without the privileges to build the jail, jobs fail closed. CPU timing on shared vCPUs varies about 14%, acceptable for verdicts (2× headroom); runtime percentiles need coarse buckets or repeated runs.
