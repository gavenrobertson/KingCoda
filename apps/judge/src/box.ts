import { DurableObject } from 'cloudflare:workers';
import type { BoxJob, BoxResult } from '@kingcoda/judge-core';
import type { Env } from './env.ts';

/** Sleep after 10 idle minutes: the box costs nothing while you're not practising. */
const INACTIVITY_MS = 10 * 60 * 1000;
/** Start fresh periodically even though every job already cleans up after itself. */
const RECYCLE_AFTER_JOBS = 200;
/** On OLE the box returns up to the output limit; keep only what the verdict needs. */
const OLE_STDOUT_KEEP = 1 << 20;

/**
 * One judge box. The durable_object scheduling policy makes this object start the container,
 * pick its size and turn off its network. kc-run takes one job at a time, so jobs are chained.
 */
export class JudgeBox extends DurableObject<Env> {
  private ready?: Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private jobs = 0;

  /** Starts the box if it's asleep, so the first Run doesn't wait for a cold start. */
  async warm(): Promise<void> {
    await this.ensure();
  }

  async run(job: BoxJob): Promise<BoxResult> {
    const next = this.chain.then(() => this.exec(job));
    this.chain = next.catch(() => undefined);
    return next;
  }

  private ensure(): Promise<void> {
    this.ready ??= this.start().catch((e) => {
      this.ready = undefined;
      throw e;
    });
    return this.ready;
  }

  private async exec(job: BoxJob): Promise<BoxResult> {
    await this.ensure();
    const port = this.ctx.container!.getTcpPort(8080);
    const res = await port.fetch('http://box/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job),
    });
    if (!res.ok) throw new Error(`box answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const result = (await res.json()) as BoxResult;

    for (const t of result.tests) {
      if (t.status === 'ole' && t.stdout.length > OLE_STDOUT_KEEP) {
        const cut = t.stdout.lastIndexOf('\n', OLE_STDOUT_KEEP);
        t.stdout = t.stdout.slice(0, cut + 1);
      }
    }

    // Processes that outlived their step were killed, but a box that needed it starts over.
    if (++this.jobs >= RECYCLE_AFTER_JOBS || result.strays > 0) await this.recycle();
    return result;
  }

  private async recycle() {
    this.jobs = 0;
    this.ready = undefined;
    await this.ctx.container?.destroy();
  }

  private async start() {
    const c = this.ctx.container;
    if (!c) throw new Error('no container configured');
    if (!c.running) {
      c.start({
        image: c.images.base,
        // 1 vCPU, 3 GiB. No outbound internet, no intercepts.
        instance: { vcpu: 1, memoryMib: 3072, diskMb: 8000 },
        enableInternet: false,
      } as ContainerStartupOptions);
    }
    await c.setInactivityTimeout(INACTIVITY_MS);
    // start() returns before kc-run listens.
    for (let i = 0; i < 120; i++) {
      try {
        if ((await c.getTcpPort(8080).fetch('http://box/healthz')).ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('box did not become healthy within 60 s');
  }
}
