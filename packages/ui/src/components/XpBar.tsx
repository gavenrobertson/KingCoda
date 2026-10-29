import { cn } from '../cn.ts';

export interface XpBarProps {
  level: number;
  /** Total XP earned. */
  xp: number;
  /** Total XP at which the next level starts. */
  nextAt: number;
  /** XP inside the current level and the size of the level, which drive the fill. */
  intoLevel: number;
  levelSpan: number;
  /** Fresh XP to flash in pale gold before it settles. */
  gain?: number;
  compact?: boolean;
  className?: string;
}

export function XpBar({
  level,
  xp,
  nextAt,
  intoLevel,
  levelSpan,
  gain = 0,
  compact,
  className,
}: XpBarProps) {
  const span = Math.max(1, levelSpan);
  const fresh = Math.min(gain, intoLevel);
  const base = Math.min(100, ((intoLevel - fresh) / span) * 100);
  const flash = Math.min(100 - base, (fresh / span) * 100);
  return (
    <div className={cn('flex flex-col gap-1', compact ? 'w-36' : 'w-full', className)}>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-bold text-gold-text">Lv {level}</span>
        <span className="font-mono text-xs text-text-muted">
          {xp.toLocaleString('en-US')} / {nextAt.toLocaleString('en-US')} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Level ${level} progress`}
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={intoLevel}
        aria-valuetext={`${(nextAt - xp).toLocaleString('en-US')} XP to level ${level + 1}`}
        className={cn(
          'flex overflow-hidden rounded-kc-pill bg-border',
          compact ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className="bg-gold transition-[width] duration-[600ms] ease-out"
          style={{ width: `${base}%` }}
        />
        {flash > 0 && <div className="bg-gold-flash" style={{ width: `${flash}%` }} />}
      </div>
    </div>
  );
}
