import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb } from '@kingcoda/db';
import { loadViewer } from './session';

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

export const fail = (status: number, error: string, headers?: HeadersInit) =>
  json({ error }, status, headers);

/** Bindings, database and the signed-in viewer (with a finished profile) for an API route. */
export async function apiContext() {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const viewer = await loadViewer();
  return { env, ctx, db: getDb(env.DB), viewer: viewer?.profile ? viewer : null };
}
