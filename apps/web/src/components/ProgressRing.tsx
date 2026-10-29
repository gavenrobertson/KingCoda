/** Solved-of-total donut, split by difficulty in the difficulty colors. */
export function ProgressRing({
  segments,
  total,
  size = 128,
}: {
  segments: Array<{ value: number; className: string }>;
  total: number;
  size?: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="-rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-raised" />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="10"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              className={s.className}
            />
          );
          offset += len;
          return el;
        })}
    </svg>
  );
}
