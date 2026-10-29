import { flameStage } from '../flame.ts';

const OUTER =
  'M12 2.5c.8 3.4 5.8 5.6 5.8 11a5.8 5.8 0 0 1-11.6 0c0-2.6 1.3-4.4 2.6-5.6.1 2.2 1.1 3.4 2.3 3.6-.4-3.2.1-6 .9-9z';
const INNER =
  'M12 11c.4 1.7 2.9 2.6 2.9 5a2.9 2.9 0 0 1-5.8 0c0-1.3.7-2.3 1.4-2.9.2 1 .7 1.4 1.2 1.5-.2-1.4 0-2.6.3-3.6z';
const SIZES = [20, 20, 22, 24] as const;

export function StreakFlame({ streak }: { streak: number }) {
  const stage = flameStage(streak);
  const size = SIZES[stage];
  const label = streak > 0 ? `${streak}-day streak` : 'No streak yet';
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-sm font-bold"
      aria-label={label}
      title={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={
          stage === 3
            ? { filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--kc-gold) 45%, transparent))' }
            : undefined
        }
      >
        <path
          d={OUTER}
          fill={
            stage === 0
              ? 'var(--kc-border-strong)'
              : stage === 1
                ? 'var(--kc-flame-dim)'
                : 'var(--kc-flame)'
          }
        />
        {stage >= 2 && (
          <path d={INNER} fill={stage === 3 ? 'var(--kc-gold-flash)' : 'var(--kc-gold)'} />
        )}
      </svg>
      <span className={stage === 0 ? 'text-text-muted' : 'text-flame'} aria-hidden="true">
        {streak}
      </span>
    </span>
  );
}
