import Link from 'next/link';
import { GoldAmount, StreakFlame, Wordmark, XpBar } from '@kingcoda/ui';
import { levelFromXp } from '@kingcoda/game';
import { getViewer } from '@/lib/session';
import type { Theme } from '@/lib/theme';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export async function SiteHeader({ theme }: { theme: Theme }) {
  const viewer = await getViewer();
  const p = viewer?.profile;
  const progress = p ? levelFromXp(p.xp) : null;

  return (
    <header className="flex min-h-[60px] flex-wrap items-center gap-x-7 gap-y-3 border-b border-border-subtle px-4 py-2.5 sm:px-6">
      <Link href="/" className="text-text no-underline" aria-label="KingCoda home">
        <Wordmark />
      </Link>
      <NavLinks />
      <div className="min-w-0 flex-1" />
      <div className="flex items-center gap-3.5">
        <ThemeToggle theme={theme} />
        {p && progress ? (
          <>
            <GoldAmount gold={p.gold} />
            <StreakFlame streak={p.streakCurrent} />
            <XpBar
              compact
              className="hidden md:flex"
              level={progress.level}
              xp={p.xp}
              nextAt={progress.nextAt}
              intoLevel={progress.intoLevel}
              levelSpan={progress.levelSpan}
            />
            <UserMenu name={p.displayName} handle={p.handle} image={viewer.user.image ?? null} />
          </>
        ) : viewer ? (
          <Link
            href="/welcome"
            className="inline-flex h-9 items-center rounded-kc-md bg-violet px-3.5 font-semibold text-on-violet no-underline hover:bg-violet-hover"
          >
            Finish setup
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center rounded-kc-md bg-violet px-3.5 font-semibold text-on-violet no-underline hover:bg-violet-hover"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
