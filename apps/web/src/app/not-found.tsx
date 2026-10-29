import Link from 'next/link';
import { cookies } from 'next/headers';
import { EmptyState } from '@/components/EmptyState';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';

export default async function NotFound() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader theme={theme} />
      <main id="main" className="px-4 pt-20">
        <EmptyState
          title="Nothing on this throne"
          body="That page doesn't exist, or it moved."
          action={
            <Link href="/problems" className="font-semibold">
              Back to problems
            </Link>
          }
        />
      </main>
    </>
  );
}
