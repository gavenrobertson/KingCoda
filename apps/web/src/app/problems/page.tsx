import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { count, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, problem } from '@kingcoda/db';
import { EmptyState } from '@/components/EmptyState';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Problems' };

export default async function ProblemsPage() {
  const viewer = await getViewer();
  if (viewer && !viewer.profile) redirect('/welcome');

  const { env } = await getCloudflareContext({ async: true });
  const [row] = await getDb(env.DB)
    .select({ n: count() })
    .from(problem)
    .where(eq(problem.status, 'published'));
  const total = row?.n ?? 0;

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[38px] font-[750] leading-tight tracking-[-0.03em]">
          Problems
        </h1>
        <p className="text-text-muted">
          {total === 0
            ? 'The problem bank is being forged.'
            : `${total.toLocaleString('en-US')} problems`}
        </p>
      </div>
      {total === 0 && (
        <EmptyState
          title="No problems yet"
          body="The first 25 seed problems arrive in Phase 2, together with the editor and the judge. Your streak starts the day they land."
        />
      )}
    </div>
  );
}
