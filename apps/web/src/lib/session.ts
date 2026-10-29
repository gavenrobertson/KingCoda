import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, profile } from '@kingcoda/db';
import { getAuth } from './auth';

/**
 * Current session + KingCoda profile (null profile = signed in but onboarding not finished).
 * Uncached: use in server actions that change the viewer, because a redirect after an action
 * renders the next page in the same request and would otherwise reuse the stale cached value.
 */
export async function loadViewer() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const [row] = await db.select().from(profile).where(eq(profile.userId, session.user.id)).limit(1);
  return { user: session.user, profile: row ?? null };
}

/** Per-request cached viewer for rendering. */
export const getViewer = cache(loadViewer);

export type Viewer = NonNullable<Awaited<ReturnType<typeof loadViewer>>>;
