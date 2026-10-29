import { cn } from '../cn.ts';

const CROWN = 'M7 18.5 L5.8 10 L10.6 13.6 L14 7.5 L17.4 13.6 L22.2 10 L21 18.5 Z';

export function CrownMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <rect width="28" height="28" rx="8" fill="var(--kc-violet)" />
      <path d={CROWN} fill="var(--kc-gold)" />
      <rect x="7" y="20" width="14" height="2.2" rx="1.1" fill="var(--kc-gold)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <CrownMark />
      <span className="font-display text-xl font-[750] tracking-[-0.02em]">KingCoda</span>
    </span>
  );
}
