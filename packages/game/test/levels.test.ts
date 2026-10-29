import { describe, expect, it } from 'vitest';
import { levelFromXp, MAX_LEVEL, xpToReach } from '../src/levels.ts';

describe('level curve', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, intoLevel: 0, levelSpan: 15, nextAt: 15 });
  });

  it('puts level 15 near 3,000 XP', () => {
    expect(xpToReach(15)).toBe(2940);
    expect(levelFromXp(2375).level).toBe(13);
    expect(levelFromXp(2940).level).toBe(15);
  });

  it('is exact at every threshold boundary', () => {
    for (let l = 1; l < 120; l++) {
      expect(levelFromXp(xpToReach(l)).level).toBe(l);
      if (l > 1) expect(levelFromXp(xpToReach(l) - 1).level).toBe(l - 1);
    }
  });

  it('is monotonic and never negative', () => {
    let prev = 1;
    for (let xp = -10; xp < 20000; xp += 37) {
      const { level, intoLevel } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      expect(intoLevel).toBeGreaterThanOrEqual(0);
      prev = level;
    }
  });

  it('caps at the max level', () => {
    expect(levelFromXp(1e12).level).toBe(MAX_LEVEL);
  });
});
