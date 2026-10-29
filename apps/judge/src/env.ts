import type { JudgeBox } from './box.ts';

export interface Env {
  APP_ENV: string;
  DB: D1Database;
  CODE: R2Bucket;
  TESTS: R2Bucket;
  JOBS: Queue<JobMessage>;
  /** Deployed: the box Durable Object. */
  JUDGE_BOX?: DurableObjectNamespace<JudgeBox>;
  /** Local dev and e2e: a judge box running in Docker, used instead of JUDGE_BOX. */
  JUDGE_BOX_URL?: string;
}

export interface JobMessage {
  submissionId: string;
}
