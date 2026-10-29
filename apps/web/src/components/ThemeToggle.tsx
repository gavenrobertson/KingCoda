'use client';
import { useOptimistic, useTransition } from 'react';
import { setTheme } from '@/app/actions';
import type { Theme } from '@/lib/theme';

const NEXT: Record<Theme, Theme> = { dark: 'light', light: 'system', system: 'dark' };
const LABEL: Record<Theme, string> = { dark: 'Dark', light: 'Light', system: 'System' };

function Icon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  if (theme === 'dark')
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  if (theme === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeToggle({ theme }: { theme: Theme }) {
  const [shown, setShown] = useOptimistic(theme);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[shown];
        document.documentElement.dataset.theme = next;
        startTransition(async () => {
          setShown(next);
          await setTheme(next);
        });
      }}
      className="inline-flex size-9 items-center justify-center rounded-kc-md border border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      aria-label={`Theme: ${LABEL[shown]}. Switch to ${LABEL[NEXT[shown]]}.`}
      title={`Theme: ${LABEL[shown]}`}
    >
      <Icon theme={shown} />
    </button>
  );
}
