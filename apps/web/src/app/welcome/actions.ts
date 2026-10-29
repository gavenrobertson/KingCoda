'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, profile } from '@kingcoda/db';
import { handleSchema } from '@/lib/handle';
import { loadViewer } from '@/lib/session';

export interface WelcomeState {
  error?: string;
}

export async function createProfile(_prev: WelcomeState, form: FormData): Promise<WelcomeState> {
  const viewer = await loadViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.profile) redirect('/problems');

  const parsed = handleSchema.safeParse(form.get('handle'));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid handle.' };
  const tz = String(form.get('tz') ?? 'UTC').slice(0, 64) || 'UTC';

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const taken = await db
    .select({ id: profile.userId })
    .from(profile)
    .where(eq(profile.handle, parsed.data))
    .limit(1);
  if (taken.length) return { error: `@${parsed.data} is taken. Try another.` };

  await db.insert(profile).values({
    userId: viewer.user.id,
    handle: parsed.data,
    displayName: viewer.user.name || parsed.data,
    tz,
  });
  // The header (root layout) shows profile data; layouts survive soft navigation unless revalidated.
  revalidatePath('/', 'layout');
  redirect('/problems');
}
