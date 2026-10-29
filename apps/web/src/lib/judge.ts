import 'server-only';

/** The judge Worker's RPC entrypoint (apps/judge/src/index.ts), reached via the JUDGE service binding. */
interface JudgeRpc {
  submit(submissionId: string): Promise<{ queued: true }>;
  warm(): Promise<void>;
}

/** Hands a stored submission to the judge. Throws unless the judge acknowledged it. */
export async function queueSubmission(env: CloudflareEnv, id: string): Promise<void> {
  // An unbound service (e.g. the judge Worker isn't running locally) answers RPC with nothing.
  const ack = await (env.JUDGE as unknown as JudgeRpc).submit(id);
  if (!ack || ack.queued !== true) throw new Error('the judge did not acknowledge the submission');
}

/** Best effort: wake the judge box. Never throws. */
export async function warmJudge(env: CloudflareEnv): Promise<void> {
  try {
    await (env.JUDGE as unknown as JudgeRpc).warm();
  } catch {
    // warming is an optimisation
  }
}
