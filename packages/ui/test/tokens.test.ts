import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blend, contrast } from '../src/contrast.ts';
import { contrastReport } from '../src/contrast-report.ts';
import { buildThemeCss } from '../src/css.ts';
import { dark, light } from '../src/tokens.ts';
import { flameStage } from '../src/flame.ts';

describe('contrast helpers', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('blends a foreground over a background', () => {
    expect(blend('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  });
});

describe('Night Court palette', () => {
  it('has the same token names in both themes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('meets WCAG AA for every declared pair', () => {
    const failures = contrastReport().filter((r) => !r.pass);
    expect(failures).toEqual([]);
  });

  it('keeps the canvas brand colors in dark mode', () => {
    expect(dark.ground).toBe('#0B0D14');
    expect(dark.violet).toBe('#6A57F5');
    expect(dark.gold).toBe('#FFC94A');
    expect([dark.easy, dark.medium, dark.hard]).toEqual(['#2DD4A7', '#F5B544', '#FF6B81']);
  });

  it('generated theme.css is up to date with tokens.ts', () => {
    const file = readFileSync(
      fileURLToPath(new URL('../styles/theme.css', import.meta.url)),
      'utf8',
    );
    expect(file).toBe(buildThemeCss());
  });
});

describe('flameStage', () => {
  it.each([
    [0, 0],
    [1, 1],
    [6, 1],
    [7, 2],
    [29, 2],
    [30, 3],
    [365, 3],
  ])('streak %i → stage %i', (streak, stage) => {
    expect(flameStage(streak)).toBe(stage);
  });
});
