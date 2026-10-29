# Judge spike report

Status: **Local stage passed · Cloudflare stage waiting on account access (D9)** · 2026-10-29

This spike tests whether the judge design in [ARCHITECTURE §5](../ARCHITECTURE.md#5-the-judge) is safe and fast enough before Phase 2 builds on it. Code: [`judge-spike/`](../../judge-spike/).

## What was built

- **`kc-exec`** (C, static): the last trusted step before user code. It runs `setsid`, then sets rlimits (CPU, stack, file size, process count, open files, no core dumps), clears groups, drops to uid 2000, sets `PR_SET_NO_NEW_PRIVS`, installs a seccomp filter and calls `execve` with a fixed environment. The filter kills non-x86_64 ABIs. It denies non-Unix sockets, namespace flags on `clone`, `clone3` (forcing the inspectable fallback), every uid/gid/capability change, mount/pivot/chroot, ptrace and cross-process memory access, io_uring, bpf/perf, keyrings, module and kexec calls, and clock/host changes.
- **`kc-run`** (Go): the supervisor inside each box. It takes one job at a time over HTTP, compiles and runs every test through `kc-exec`, reads CPU time and peak RSS from the kernel (`wait4`), polls memory every 10 ms and kills over the limit, caps stdout, enforces a wall-clock limit and cleans the box between steps and jobs. It never sees expected outputs.
- **Box image**: Debian trixie with Python 3, Node and g++; **tini** is PID 1. Compressed size is 174 MB.
- **Probe suite**: 30 hostile or edge-case programs plus a 30-run CPU-timing check. One suite runs against local Docker (`probes/run.ts`) and against a deployed Container through the spike Worker (`worker/`).

## Results — local (Docker, 1 vCPU / 3 GiB)

**30/30 probes pass**, repeated across 3 runs and again in a `--privileged` container (where only our own seccomp filter is active):

| Group       | Probes                                                                                                                                                                                                                                                                                                                      | Result |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Correctness | stdin I/O in Python/JS/C++, compile error → CE with log, exception → RE with trace, stop-on-first-failure                                                                                                                                                                                                                   | pass   |
| Limits      | infinite loop (Py, C++) → TLE; `sleep(600)` → wall TLE in ~3 s; memory bombs (Py, C++, JS) → MLE; output flood → OLE capped at the limit; fork bombs (Py, C++) contained; deep recursion → RE; 1 GB file write stopped by RLIMIT_FSIZE                                                                                      | pass   |
| Isolation   | AF_INET/INET6/raw/netlink/packet sockets denied; no writes to `/etc`, `/usr`, `/opt/kc`, `/work`, `/root`; can't read the supervisor's `environ`/`mem`; can't list `/work`; `setuid(0)`/`setresuid`/`setgid` fail; `unshare`, `mount`, `ptrace`, `chroot` fail; `kill(-1)` can't reach the supervisor; io_uring unavailable | pass   |
| Hygiene     | daemonised grandchild (`fork`+`setsid`) killed and counted; no sandbox process survives into the next job; files planted in `/tmp` and `/dev/shm` are gone for the next job                                                                                                                                                 | pass   |

The sandboxed process reports `CapEff 0`, `NoNewPrivs 1` and seccomp mode 2, even when the box's root holds every capability.

| Metric                                       | Result                   | Target              |
| -------------------------------------------- | ------------------------ | ------------------- |
| CPU-time stability, 30 runs of a 0.58 s loop | CV 0.3–0.5% (573–584 ms) | < 10%               |
| Warm job, Worker → DO → Container → result   | 19 ms (Python hello)     | < 300 ms overhead   |
| Cold start (local `wrangler dev`)            | 0.55 s                   | < 5 s on Cloudflare |

## Bugs the spike caught (all fixed)

1. **Zombie build-up.** `kc-run` ran as PID 1 and never reaped orphans. Their zombies counted against `RLIMIT_NPROC` and broke every later job. → tini is now PID 1.
2. **Fork bombs outran cleanup.** Killing processes one at a time lets survivors fork into freed slots. → `kc-exec --kill-uid` drops to the sandbox uid and sends one `kill(-1, SIGKILL)`, which the kernel delivers atomically.
3. **A late sweep killed the next job.** A timeout's cleanup kept running after its step returned. → Kills are now bounded to their step; the full sweep runs only between steps.
4. **Daemons held stdout open.** A program that exited cleanly but left a background child was reported as TLE after the wall timeout. → The supervisor stops reading 100 ms after the main process exits; the sweep kills the straggler.
5. **CPU-limit kills read as RE.** Rusage can read a hair under the limit when `SIGXCPU` fires. → `SIGXCPU` means TLE.

## Still to verify on Cloudflare

The decisive questions can only be answered on a deployed Container, which needs the Cloudflare account (D9):

1. Does a non-root uid really have **no capabilities** under the default scheduling policy (`/introspect` → `sandboxedProcess`)? The local result says the design holds even if not, because seccomp alone blocks privilege changes. The deployed result decides whether we rely on one layer or two.
2. Does `enableInternet = false` block egress at the VM level, in addition to our socket filter?
3. Real cold start of the 174 MB image, and CPU-time stability on shared Cloudflare vCPUs.

Steps: [`judge-spike/README.md`](../../judge-spike/README.md#run-on-cloudflare-the-deciding-test). It takes about 10 minutes and costs cents.

## Recommendation

**Go**, conditional on the Cloudflare run: build Phase 2's judge on this design (D3). If the deployed box shows sandboxed processes holding capabilities, the design still stands on seccomp, and Phase 2 adds the planned fallback of recycling the box after every non-AC verdict.
