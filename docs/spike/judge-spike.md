# Judge spike report

Status: **Passed on Cloudflare (2026-10-29)** · Code: [`judge/`](../../judge/) · Workflow: _Judge spike on Cloudflare_ (manual)

This spike tested whether the judge design in [ARCHITECTURE §5](../ARCHITECTURE.md#5-the-judge) is safe and fast enough before Phase 2 builds on it.

## Result

|                              | Local Docker (`--privileged`)                                     | Cloudflare Container (1 vCPU, 3 GiB)                |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Hostile probes               | **32/32**                                                         | **32/32** (cold box and warm box)                   |
| Sandboxed process            | CapEff/CapPrm/CapBnd 0, NoNewPrivs 1, seccomp 2                   | same                                                |
| Visible to user code         | its own processes; `bin dev etc lib lib64 proc sbin tmp usr work` | same                                                |
| cgroup v2 limits             | not available (cgroup v1 host) → RSS polling                      | **enabled** (memory, pids)                          |
| CPU-time stability (30 runs) | CV 0.2–0.5%                                                       | **CV 13–14%**                                       |
| Warm job, end to end         | 16–19 ms                                                          | 150–400 ms                                          |
| Cold start                   | 0.5–1.8 s                                                         | 10–19 s for a new box; < 0.3 s when already running |

## What Cloudflare changed about the design

1. **New accounts only get the `durable_object` scheduling policy.** The Durable Object starts its own container (`ctx.container.start({ image, instance, enableInternet: false })`). The spike Worker and the Phase 2 judge use this API.
2. **Users and capabilities can't be the isolation boundary there.** Cloudflare documents that every process keeps root's capabilities regardless of uid. The first deployed run proved it: `kc-exec` stripped capabilities, re-checked, found some still present, and refused to run user code. That fail-closed check is why no probe could escape, and every job became a sandbox error instead.
3. **So `kc-exec` now builds a namespace jail**, the nsjail-style design:
   - **Namespaces.** User code is cloned into new PID, mount, network, IPC and UTS namespaces. It is PID 1 there: it can't see or signal `kc-run`, and everything it leaves behind dies with it.
   - **Minimal root.** It `pivot_root`s into a minimal root: read-only `/usr` and `/etc`, the job directory as `/work`, a private 64 MB `/tmp`, four device nodes, and a `/proc` mounted `subset=pid` that shows only the sandbox's processes.
   - **Seccomp written for a process that may hold every capability.** On top of the earlier rules (no non-Unix sockets, namespaces, mounts, ptrace, io_uring, bpf, module/kexec, clock changes), it blocks raising resource limits (`setrlimit`, `prlimit64` writes), `mknod`, real-time scheduling, `mlock`, `PR_SET_MM` and page migration.
   - **Limits a capable process can't bypass.** `kc-run` gives each step a cgroup v2 with `memory.max`, `pids.max` and an atomic `cgroup.kill`, since `RLIMIT_NPROC` doesn't bind a process with `CAP_SYS_RESOURCE`.
   - **No `kill(-1)` helper.** The earlier `kill(-1)` sweep was removed, because from a process with `CAP_KILL` it would hit the supervisor. Sweeps now kill sandbox processes one by one, and fork bombs can't outrun them because their PID namespace dies with its init.
4. **Fails closed.** Without the privileges to build the jail (for example, an unprivileged Docker container), every job ends as `sandbox_fail` ("clone namespaces: Operation not permitted"); user code never runs unprotected.

On Cloudflare, the jailed process in fact ends up with no effective, permitted or bounding capabilities. Only the inheritable set is non-empty, which is inert with an empty bounding set and no ambient capabilities. The design doesn't depend on that, though.

## Bugs found and fixed along the way

1. **Zombie build-up.** `kc-run` ran as PID 1 and never reaped orphans. Their zombies counted against `RLIMIT_NPROC` and broke later jobs. → tini is PID 1.
2. **Fork bombs outran per-process cleanup.** → Atomic sweeps, then PID-namespace teardown.
3. **A late sweep killed the next job.** → Kills are bounded to their step.
4. **Daemons held stdout open**, turning a clean exit into a TLE. → Output reading stops 100 ms after exit.
5. **CPU-limit kills read as RE.** → `SIGXCPU` means TLE.
6. **Capabilities survive a uid drop on Cloudflare.** → Namespace jail plus a seccomp filter designed for that (above).

## Open items carried into Phase 2

- **Timing noise on shared vCPUs (CV ~14%).** It doesn't affect verdicts: time limits keep 2× headroom over the reference. It does make "beats X%" percentiles wobble. Options, cheapest first: coarser histogram buckets; then the median of 3 runs for accepted submissions only; then dedicated-vCPU instance sizes.
- **Cold start of a brand-new box is 10–19 s.** Opening a problem pre-warms a box (ARCHITECTURE §5.6), so most Runs should hit a warm box.

## Recommendation

**Go.** Build the Phase 2 judge on `kc-run` + the jailed `kc-exec`, using the `durable_object` scheduling policy (D3 confirmed).
