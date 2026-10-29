export type FlameStage = 0 | 1 | 2 | 3;

/** Streak flame growth stages from the design: none, 1–6, 7–29, 30+ days. */
export function flameStage(streak: number): FlameStage {
  if (streak <= 0) return 0;
  if (streak < 7) return 1;
  if (streak < 30) return 2;
  return 3;
}
