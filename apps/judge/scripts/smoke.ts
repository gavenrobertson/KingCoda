// Production smoke test for the judge, run by the Deploy workflow: a Run of a known-correct
// solution goes through the real queue, Worker, Durable Object and container, and must come
// back Accepted. Runs never touch progress or acceptance stats; the row and code are removed after.
// Needs CLOUDFLARE_API_TOKEN (D1, R2, Queues write) and CLOUDFLARE_ACCOUNT_ID.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV = ['--env', 'production', '--remote'];
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account)
  throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');

const wrangler = (...args: string[]) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
const sql = (q: string) =>
  (
    JSON.parse(wrangler('d1', 'execute', 'DB', '--json', '--command', q, ...ENV)) as Array<{
      results: Array<Record<string, unknown>>;
    }>
  )[0]!.results;

const CODE = `class Solution {
public:
    vector<int> twinCoins(vector<int>& weights, int target) {
        unordered_map<long long, int> first;
        for (int j = 0; j < (int)weights.size(); j++) {
            auto it = first.find((long long)target - weights[j]);
            if (it != first.end()) return {it->second, j};
            first.emplace(weights[j], j);
        }
        return {-1, -1};
    }
};
`;

const id = `smoke${Date.now()}`;
const key = `subm/smoke/${id}`;
const [p] = sql(`SELECT id, version FROM problem WHERE slug = 'twin-coins'`);
if (!p) throw new Error('twin-coins is not published');

const tmp = mkdtempSync(join(tmpdir(), 'kc-smoke-'));
try {
  writeFileSync(join(tmp, 'code.json'), JSON.stringify({ code: CODE }));
  wrangler('r2', 'object', 'put', `kingcoda-code/${key}`, '--file', join(tmp, 'code.json'), ...ENV);
  sql(
    `INSERT OR IGNORE INTO user (id, name, email) VALUES ('usr_smoke', 'Deploy smoke test', 'smoke@kingcoda.invalid')`,
  );
  sql(`INSERT INTO submission (id, user_id, problem_id, problem_version, lang, mode, code_r2_key, code_hash, code_bytes)
       VALUES ('${id}', 'usr_smoke', '${p.id}', ${p.version}, 'cpp', 'run', '${key}', 'smoke', ${CODE.length})`);

  const info = wrangler('queues', 'info', 'judge-jobs');
  const queueId = /Queue ID:\s*(\S+)/i.exec(info)?.[1] ?? /([0-9a-f]{32})/.exec(info)?.[1];
  if (!queueId) throw new Error(`no queue id in:\n${info}`);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/queues/${queueId}/messages`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ body: { submissionId: id }, content_type: 'json' }),
    },
  );
  if (!res.ok) throw new Error(`queue push failed: ${res.status} ${await res.text()}`);

  const t0 = Date.now();
  // A brand-new box can take a few minutes to provision on the first deploy.
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const [s] = sql(
      `SELECT status, verdict, passed, total, runtime_ms FROM submission WHERE id = '${id}'`,
    );
    const secs = Math.round((Date.now() - t0) / 1000);
    if (s && (s.status === 'done' || s.status === 'error')) {
      console.log(`judged in ${secs}s: ${s.verdict} ${s.passed}/${s.total}`);
      if (s.verdict !== 'AC') throw new Error(`expected AC, got ${s.verdict}`);
      break;
    }
    console.log(`${secs}s: ${s?.status ?? 'missing'}`);
    if (secs > 600) throw new Error('no verdict after 10 minutes');
  }
} finally {
  sql(`DELETE FROM submission WHERE id = '${id}'`);
  wrangler('r2', 'object', 'delete', `kingcoda-code/${key}`, ...ENV);
  rmSync(tmp, { recursive: true, force: true });
}
