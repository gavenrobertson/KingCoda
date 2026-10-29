import { DurableObject } from 'cloudflare:workers';
import { runProbes, type Job, type RunResult } from '../../probes/probes.ts';

interface Env {
  JUDGE_BOX: DurableObjectNamespace<JudgeBox>;
  /** Bearer token for every endpoint: this Worker runs arbitrary code on request. */
  SPIKE_TOKEN: string;
}

const INACTIVITY_MS = 10 * 60 * 1000;

/** One judge box. The durable_object policy makes this object choose the image, size and network. */
export class JudgeBox extends DurableObject<Env> {
  private ready?: Promise<void>;

  override async fetch(request: Request): Promise<Response> {
    this.ready ??= this.start().finally(() => (this.ready = undefined));
    await this.ready;
    const url = new URL(request.url);
    return this.ctx
      .container!.getTcpPort(8080)
      .fetch(new Request(`http://box${url.pathname}${url.search}`, request));
  }

  private async start() {
    const c = this.ctx.container;
    if (!c) throw new Error('no container configured');
    if (!c.running) {
      c.start({
        image: c.images.base,
        // The production box: 1 vCPU, 3 GiB. No outbound internet, no intercepts.
        instance: { vcpu: 1, memoryMib: 3072, diskMb: 8000 },
        enableInternet: false,
      } as ContainerStartupOptions);
    }
    await c.setInactivityTimeout(INACTIVITY_MS);
    // start() returns before the box listens; wait for kc-run.
    for (let i = 0; i < 120; i++) {
      try {
        const r = await c.getTcpPort(8080).fetch('http://box/healthz');
        if (r.ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('box did not become healthy within 60 s');
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!env.SPIKE_TOKEN || token !== env.SPIKE_TOKEN) return json({ error: 'unauthorized' }, 401);

    const url = new URL(request.url);
    // A fresh box name per run measures a true cold start and keeps runs independent.
    const name = url.searchParams.get('box') ?? 'spike';
    const box = env.JUDGE_BOX.get(env.JUDGE_BOX.idFromName(name));
    const call = (path: string, init?: RequestInit) =>
      box.fetch(new Request(`http://box${path}`, init));

    try {
      if (url.pathname === '/introspect') {
        const t0 = Date.now();
        const res = await call('/introspect');
        return json({ firstResponseMs: Date.now() - t0, box: name, report: await res.json() });
      }

      if (url.pathname === '/probe') {
        const t0 = Date.now();
        const health = await call('/healthz');
        const coldStartMs = Date.now() - t0;
        if (!health.ok) return json({ error: `box not healthy: ${health.status}` }, 502);

        const send = async (job: Job): Promise<RunResult> => {
          const res = await call('/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(job),
          });
          if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
          return (await res.json()) as RunResult;
        };
        const healthy = async () => (await call('/healthz')).ok;

        const w0 = Date.now();
        await send({
          id: 'warm',
          lang: 'python',
          source: 'print(1)\n',
          inputs: [''],
          timeMs: 1000,
          memoryMb: 64,
        });
        const warmJobMs = Date.now() - w0;

        const report = await runProbes(send, healthy);
        const failed = report.probes.filter((p) => !p.pass);
        return json({
          box: name,
          coldStartMs,
          warmJobMs,
          passed: report.probes.length - failed.length,
          total: report.probes.length,
          timing: report.timing,
          failed,
          probes: report.probes,
        });
      }
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }

    return json({ endpoints: ['/introspect?box=<name>', '/probe?box=<name>'] }, 404);
  },
};
