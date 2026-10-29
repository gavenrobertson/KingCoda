'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Pages land phase by phase (see docs/ROADMAP.md); only built routes are linked.
const LINKS = [{ href: '/problems', label: 'Problems' }] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-[22px]">
      {LINKS.map(({ href, label }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={
              current
                ? 'border-b-2 border-gold py-1.5 font-semibold text-text no-underline'
                : 'py-1.5 text-text-muted no-underline hover:text-text'
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
