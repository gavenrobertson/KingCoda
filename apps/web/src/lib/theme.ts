export const THEMES = ['dark', 'light', 'system'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'kc-theme';

export function parseTheme(value: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'dark';
}
