# Judge box

The sandbox that compiles and runs submissions, designed in [ARCHITECTURE §5](../docs/ARCHITECTURE.md#5-the-judge). It started as the Phase 1 spike; the findings that shaped it are in [`docs/spike/judge-spike.md`](../docs/spike/judge-spike.md).

| Path                | What                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kc-exec/kc-exec.c` | Last trusted step before user code: a namespace jail (PID, mount, network, IPC, UTS; minimal read-only root), rlimits, uid 2000, no capabilities, no-new-privs, seccomp, then `execve`         |
| `kc-run/`           | Go supervisor (HTTP `:8080`, one job at a time): writes the program's files, compiles, runs each input through kc-exec in its own cgroup, measures CPU and peak memory, caps output, cleans up |
| `include/`          | The C++ harness prelude, generated from `packages/harness` (`pnpm --filter @kingcoda/harness write:prelude`) and precompiled into the image                                                    |
| `Dockerfile`        | Box image: Debian trixie + Python 3, Node, g++, tini (PID 1, reaps orphans)                                                                                                                    |
| `probes/`           | `probes.ts`: 32 hostile-code probes and a CPU-timing check. `verdicts.ts`: verdicts end to end through [`packages/judge-core`](../packages/judge-core)                                         |
| `spike-worker/`     | The spike's Cloudflare Worker + `JudgeBox` Container (internet off) that runs the probe suite on real Cloudflare hardware                                                                      |

Expected outputs never reach the box: it returns raw stdout, and `packages/judge-core` compares results and decides the verdict in the Worker.

## Run locally (Docker)

kc-exec builds a namespace jail, which needs root with `CAP_SYS_ADMIN` (as on Cloudflare), so run the box `--privileged`. Without it, every job fails closed with `clone namespaces: Operation not permitted`.

```bash
docker build -t kingcoda-judge judge
```

```bash
docker run -d --name kcjudge --privileged --cgroupns private -p 18080:8080 --memory 3g --cpus 1 kingcoda-judge
```

```bash
node judge/probes/run.ts http://localhost:18080
```

```bash
node judge/probes/verdicts.ts http://localhost:18080
```

## Run the probes on Cloudflare

Easiest: run the **Judge spike on Cloudflare** workflow from the repo's Actions tab. It needs repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. It deploys, probes a cold box, writes the report to the run summary and deletes everything it deployed.

By hand from your own machine:

Needs the Workers Paid plan (Containers) and Docker running locally, because `wrangler deploy` builds and pushes the image.

```bash
cd judge/spike-worker && pnpm exec wrangler login
```

```bash
openssl rand -hex 24 | tee /dev/stderr | pnpm exec wrangler secret put SPIKE_TOKEN
```

```bash
pnpm deploy
```

Then, with the token printed above and the URL `wrangler deploy` reports:

```bash
curl -H "authorization: Bearer $SPIKE_TOKEN" "https://kingcoda-judge-spike.<your-subdomain>.workers.dev/introspect?box=run-1"
```

```bash
curl -H "authorization: Bearer $SPIKE_TOKEN" "https://kingcoda-judge-spike.<your-subdomain>.workers.dev/probe?box=run-2"
```

Use a new `box` name each time to measure a cold start. Delete the Worker afterwards (`pnpm exec wrangler delete`) so nothing that runs arbitrary code stays deployed.
