// Runs the probe suite against a judge box over HTTP: node probes/run.ts [baseUrl]
import { runProbes, type Job, type RunResult } from './probes.ts';

const base = process.argv[2] ?? 'http://localhost:18080';

async function send(job: Job): Promise<RunResult> {
  const res = await fetch(`${base}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(job),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as RunResult;
}

async function healthy(): Promise<boolean> {
  try {
    return (await fetch(`${base}/healthz`)).ok;
  } catch {
    return false;
  }
}

const { probes, timing } = await runProbes(send, healthy);
for (const p of probes)
  console.log(
    `${p.pass ? 'PASS' : 'FAIL'}  [${p.group}] ${p.name}${p.reason ? `\n      ${p.reason}` : ''}  (${p.ms}ms)`,
  );
console.log(
  `\nCPU timing over ${timing.runs} runs: mean ${timing.meanMs}ms, min ${timing.min}, max ${timing.max}, CV ${timing.cv}`,
);
const failed = probes.filter((p) => !p.pass).length;
const timingOk = timing.cv < 0.1;
console.log(
  `\n${probes.length - failed}/${probes.length} probes passed; timing ${timingOk ? 'stable' : 'UNSTABLE'} (CV < 0.10 required)`,
);
process.exit(failed || !timingOk ? 1 : 0);
