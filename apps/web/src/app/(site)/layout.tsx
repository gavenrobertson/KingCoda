import { cookies } from 'next/headers';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';

/** Pages with the full site header. The workspace has its own compact header. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader theme={theme} />
      <main id="main">{children}</main>
    </>
  );
}
