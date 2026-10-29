# ADR 0002 — Next.js on Workers via OpenNext

Status: Accepted 2026-10-29 (D2)

**Context.** The brief asks for Next.js App Router. Cloudflare's recommended path for _new_ Next.js apps is now vinext, which is still beta; OpenNext adapts real `next build` output and is mature.

**Decision.** Use `@opennextjs/cloudflare`. `next dev` gets real bindings through `initOpenNextCloudflareForDev()`; production runs as the `kingcoda-web` Worker.

**Consequences.** Full Next.js 16 feature set. Verified in workerd: all routes behave as in `next dev`, gzipped upload is 1.6 MiB. Node.js middleware isn't supported by OpenNext yet, so request-time logic lives in route handlers, server actions and layouts. Revisit vinext when it leaves beta.
