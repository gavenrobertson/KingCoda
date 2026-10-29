# Judge spike (Phase 1)

A go/no-go prototype for the judge design in [ARCHITECTURE §5](../docs/ARCHITECTURE.md#5-the-judge). Findings are in [`docs/spike/judge-spike.md`](../docs/spike/judge-spike.md).

| Path                | What                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kc-exec/kc-exec.c` | Last trusted step before user code: rlimits, drop to uid 2000, no-new-privs, seccomp, `execve`. Also `--kill-uid` for an atomic sweep of every sandbox process          |
| `kc-run/`           | Go supervisor (HTTP `:8080`): compiles and runs each test through kc-exec, measures CPU time and peak RSS, caps output, enforces wall time, cleans the box between jobs |
| `Dockerfile`        | Box image: Debian trixie + Python 3, Node, g++, tini (PID 1, reaps orphans)                                                                                             |
| `probes/`           | 30 hostile-code probes plus a CPU-timing stability check, shared by the local runner and the Worker                                                                     |
| `worker/`           | Cloudflare Worker + `JudgeBox` Container (internet off) that runs the probe suite on real Cloudflare hardware                                                           |

## Run locally (Docker)

```bash
docker build -t kingcoda-judge-spike judge-spike
```

```bash
docker run -d --name kcjudge -p 18080:8080 --memory 3g --cpus 1 kingcoda-judge-spike
```

```bash
node judge-spike/probes/run.ts http://localhost:18080
```

## Run on Cloudflare (the deciding test)

Needs the Workers Paid plan (Containers) and Docker running locally, because `wrangler deploy` builds and pushes the image.

```bash
cd judge-spike/worker && pnpm exec wrangler login
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
