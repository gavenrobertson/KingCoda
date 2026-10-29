import { Container, getContainer } from '@cloudflare/containers';
import { runProbes, type Job, type RunResult } from '../../probes/probes.ts';

interface Env {
  JUDGE_BOX: DurableObjectNamespace<JudgeBox>;
  /** Bearer token for every endpoint: this Worker runs arbitrary code on request. */
  SPIKE_TOKEN: string;
}

export class JudgeBox extends Container<Env> {
  override defaultPort = 8080;
  override sleepAfter = '10m';
  // The production setting: no outbound internet, no allowed hosts, no outbound handlers.
  override enableInternet = false;
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
    const box = getContainer(env.JUDGE_BOX, name);
    const call = (path: string, init?: RequestInit) =>
      box.fetch(new Request(`http://box${path}`, init));

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

      // Warm latency: a trivial Python job end to end.
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

    return json({ endpoints: ['/introspect?box=<name>', '/probe?box=<name>'] }, 404);
  },
};
