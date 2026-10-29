import { WorkerEntrypoint } from 'cloudflare:workers';
import { getDb } from '@kingcoda/db';
import type { BoxJob, BoxResult } from '@kingcoda/judge-core';
import type { Env, JobMessage } from './env.ts';
import { judgeSubmission, markError, type JudgeDeps } from './flow.ts';

export { JudgeBox } from './box.ts';

/** Personal-use scale: one box. A pool of boxes replaces this name when there are more users. */
const BOX_NAME = 'box-0';
const MAX_ATTEMPTS = 3;

function runBox(env: Env): (job: BoxJob) => Promise<BoxResult> {
  if (env.JUDGE_BOX_URL) {
    const url = env.JUDGE_BOX_URL;
    return async (job) => {
      const res = await fetch(`${url}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!res.ok)
        throw new Error(`box answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as BoxResult;
    };
  }
  const ns = env.JUDGE_BOX;
  if (!ns) throw new Error('neither JUDGE_BOX nor JUDGE_BOX_URL is configured');
  return (job) => ns.get(ns.idFromName(BOX_NAME)).run(job);
}

function deps(env: Env): JudgeDeps {
  return { db: getDb(env.DB), code: env.CODE, tests: env.TESTS, runBox: runBox(env) };
}

/** The web Worker calls these through its service binding. */
export default class Judge extends WorkerEntrypoint<Env> {
  /**
   * Queue a submission whose row and code the web Worker has already written. Returns an explicit
   * acknowledgement so the caller can tell a real judge from an unbound service stub.
   */
  async submit(submissionId: string): Promise<{ queued: true }> {
    await this.env.JOBS.send({ submissionId });
    return { queued: true };
  }

  /** Wake the box when someone opens a problem, so their first Run skips the cold start. */
  async warm(): Promise<void> {
    if (this.env.JUDGE_BOX_URL || !this.env.JUDGE_BOX) return;
    const box = this.env.JUDGE_BOX.get(this.env.JUDGE_BOX.idFromName(BOX_NAME));
    this.ctx.waitUntil(box.warm().catch(() => undefined));
  }

  /** Liveness only (dev tooling waits on it). Judging is reachable only through RPC. */
  override async fetch(request: Request): Promise<Response> {
    const ok = new URL(request.url).pathname === '/';
    return new Response(ok ? 'KingCoda judge' : 'Not found', { status: ok ? 200 : 404 });
  }

  override async queue(batch: MessageBatch<JobMessage>): Promise<void> {
    const d = deps(this.env);
    for (const msg of batch.messages) {
      const id = msg.body.submissionId;
      try {
        await judgeSubmission(d, id);
        msg.ack();
      } catch (e) {
        const err = e as Error & { cause?: Error };
        const message = err.cause ? `${err.message} (${err.cause.message})` : err.message;
        console.error(`judge ${id} attempt ${msg.attempts}: ${message}`);
        if (msg.attempts >= MAX_ATTEMPTS) {
          await markError(d.db, id, 'The judge is unavailable right now. Try again in a minute.');
          msg.ack();
        } else {
          msg.retry({ delaySeconds: 2 * msg.attempts });
        }
      }
    }
  }
}
