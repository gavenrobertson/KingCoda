import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'KingCoda', template: '%s · KingCoda' },
  description: 'Practice coding problems. Every accepted solve earns its crown.',
};

export const viewport: Viewport = {
  themeColor: '#0B0D14',
  colorScheme: 'dark light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme is rendered on the server from a cookie, so there is no flash of the wrong theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-kc-md focus:bg-violet focus:px-3 focus:py-2 focus:text-on-violet"
        >
          Skip to content
        </a>
        <SiteHeader theme={theme} />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
