import { blend, contrast } from './contrast.ts';
import { chipAlpha, contrastPairs, dark, light, type Palette } from './tokens.ts';

export interface ContrastResult {
  theme: 'dark' | 'light';
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  pass: boolean;
}

export function contrastReport(): ContrastResult[] {
  const themes: Array<['dark' | 'light', Palette]> = [
    ['dark', dark],
    ['light', light],
  ];
  return themes.flatMap(([theme, p]) =>
    contrastPairs.map(({ fg, bg, min, chip }) => {
      const bgHex = chip ? blend(p[fg], p[bg], chipAlpha) : p[bg];
      const ratio = contrast(p[fg], bgHex);
      return {
        theme,
        fg,
        bg: chip ? `${fg}-chip/${bg}` : bg,
        ratio: Math.round(ratio * 100) / 100,
        min,
        pass: ratio >= min,
      };
    }),
  );
}
