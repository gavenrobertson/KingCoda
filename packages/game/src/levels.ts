/**
 * Level curve: total XP needed to *reach* level L is round(C·(L−1)²).
 * C = 15 puts level 15 at 2,940 XP, close to the canvas's mock "Lv 14 · 2,375 / 3,000 XP".
 * (The canvas numbers are illustrative and don't sit exactly on any smooth curve.)
 * Final tuning happens in Phase 4; keep every caller on these helpers so a retune is one constant.
 */
export const LEVEL_CURVE_C = 15;
export const MAX_LEVEL = 200;

export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.round(LEVEL_CURVE_C * (level - 1) ** 2);
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level spans (next threshold − this threshold). */
  levelSpan: number;
  /** Total XP at which the next level starts. */
  nextAt: number;
}

export function levelFromXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  // Invert the curve, then correct for rounding at the boundaries.
  let level = Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp / LEVEL_CURVE_C)) + 1);
  while (level < MAX_LEVEL && xpToReach(level + 1) <= xp) level++;
  while (level > 1 && xpToReach(level) > xp) level--;
  const start = xpToReach(level);
  const nextAt = level >= MAX_LEVEL ? start : xpToReach(level + 1);
  return { level, intoLevel: xp - start, levelSpan: Math.max(1, nextAt - start), nextAt };
}
