/**
 * KingCoda "Night Court" design tokens — the single source of truth.
 * Values come from the KingCoda design canvas (Brand & tokens artboard).
 * `styles/theme.css` is generated from this file: run `pnpm build:css` after editing.
 */

/** Self-hosted via Fontsource variable packages (the "… Variable" family names), with the canvas names as fallback. */
export const fonts = {
  display:
    "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Geist Variable', Geist, system-ui, sans-serif",
  sans: "'Geist Variable', Geist, 'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
} as const;

export type ColorToken =
  | 'ground'
  | 'surface'
  | 'sunken'
  | 'raised'
  | 'hover'
  | 'border'
  | 'border-subtle'
  | 'border-strong'
  | 'text'
  | 'text-muted'
  | 'text-faint'
  | 'violet'
  | 'violet-hover'
  | 'violet-light'
  | 'violet-tint'
  | 'on-violet'
  | 'gold'
  | 'gold-text'
  | 'gold-ink'
  | 'gold-deep'
  | 'gold-flash'
  | 'gold-tint'
  | 'flame'
  | 'flame-dim'
  | 'frost'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'success'
  | 'danger'
  | 'warning'
  | 'rarity-common'
  | 'rarity-rare'
  | 'rarity-epic'
  | 'rarity-legendary';

export type Palette = Record<ColorToken, string>;

export const dark: Palette = {
  ground: '#0B0D14',
  surface: '#121521',
  sunken: '#10131D',
  raised: '#181C2A',
  hover: '#161A28',
  border: '#232838',
  'border-subtle': '#1E2333',
  'border-strong': '#2E3448',
  text: '#ECEEF5',
  'text-muted': '#A3AABD',
  // Decorative only (locked icons). Fails AA as text by design.
  'text-faint': '#5B6278',
  violet: '#6A57F5',
  // Canvas used #7A68FF (lighter), but white on it is 4.0:1. Hover darkens instead.
  'violet-hover': '#6250F2',
  'violet-light': '#A79BFF',
  'violet-tint': '#2B2550',
  'on-violet': '#FFFFFF',
  gold: '#FFC94A',
  'gold-text': '#FFC94A',
  'gold-ink': '#1A1406',
  'gold-deep': '#B9811F',
  'gold-flash': '#FFF1C2',
  'gold-tint': '#1F1A12',
  flame: '#FF9F43',
  'flame-dim': '#C97A3A',
  frost: '#7DD3FC',
  easy: '#2DD4A7',
  medium: '#F5B544',
  hard: '#FF6B81',
  success: '#2DD4A7',
  danger: '#FF8A9C',
  warning: '#F5B544',
  'rarity-common': '#A3AABD',
  'rarity-rare': '#6CB4FF',
  'rarity-epic': '#B9AEFF',
  'rarity-legendary': '#FFC94A',
};

/** Derived light theme (the canvas is dark-only). Every text pair is AA-checked in tests. */
export const light: Palette = {
  ground: '#F7F7FB',
  surface: '#FFFFFF',
  sunken: '#F3F3F8',
  raised: '#F0F0F6',
  hover: '#EBEBF3',
  border: '#E2E3EC',
  'border-subtle': '#ECEDF3',
  'border-strong': '#CDD0DC',
  text: '#14151C',
  'text-muted': '#565C70',
  'text-faint': '#9AA0B2',
  violet: '#5442E0',
  'violet-hover': '#4835CC',
  'violet-light': '#4A38D4',
  'violet-tint': '#ECE9FF',
  'on-violet': '#FFFFFF',
  gold: '#FFC94A',
  'gold-text': '#8A5A00',
  'gold-ink': '#1A1406',
  'gold-deep': '#B9811F',
  'gold-flash': '#FFE08A',
  'gold-tint': '#FFF6DB',
  flame: '#E8740C',
  'flame-dim': '#B8743A',
  frost: '#0284C7',
  easy: '#066F55',
  medium: '#8A5800',
  hard: '#B32843',
  success: '#066F55',
  danger: '#B32843',
  warning: '#8A5800',
  'rarity-common': '#565C70',
  'rarity-rare': '#1F6FC9',
  'rarity-epic': '#6A4FD8',
  'rarity-legendary': '#8A5A00',
};

/** Contribution heatmap, empty → most active. */
export const heatmap = {
  dark: ['#181C29', '#2F2862', '#4A3CB0', '#6E5DF7', '#B3A8FF'],
  light: ['#ECEDF3', '#D6D1FF', '#A79BFF', '#6E5DF7', '#4A38D4'],
} as const;

/** Chip backgrounds are the foreground at this alpha over the surface. */
export const chipAlpha = 0.14;

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '18px',
  '2xl': '24px',
  pill: '99px',
} as const;

export const motion = {
  fast: '120ms',
  base: '200ms',
  xpHold: '400ms',
  xpSettle: '600ms',
  burstMax: '1200ms',
} as const;

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export const difficultyToken: Record<Difficulty, 'easy' | 'medium' | 'hard'> = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard',
};

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'IE';

export const verdictMeta: Record<Verdict, { label: string; token: ColorToken; tone: string }> = {
  AC: { label: 'Accepted', token: 'success', tone: 'Celebrate' },
  WA: { label: 'Wrong Answer', token: 'danger', tone: 'Show the diff, offer a hint' },
  TLE: { label: 'Time Limit Exceeded', token: 'warning', tone: 'Point at complexity' },
  MLE: { label: 'Memory Limit Exceeded', token: 'warning', tone: 'Point at data structures' },
  RE: { label: 'Runtime Error', token: 'danger', tone: 'Show the trace line' },
  CE: { label: 'Compile Error', token: 'text-muted', tone: 'Jump to the line' },
  IE: { label: 'Judge Error', token: 'text-muted', tone: 'Our fault, retrying' },
};

/**
 * Pairs that must meet WCAG AA. `min` is 4.5 for body text, 3 for large text / UI.
 * `chip` means the foreground sits on its own 14% tint over `bg`.
 */
export const contrastPairs: Array<{ fg: ColorToken; bg: ColorToken; min: number; chip?: boolean }> =
  [
    { fg: 'text', bg: 'ground', min: 4.5 },
    { fg: 'text', bg: 'surface', min: 4.5 },
    { fg: 'text', bg: 'raised', min: 4.5 },
    { fg: 'text-muted', bg: 'ground', min: 4.5 },
    { fg: 'text-muted', bg: 'surface', min: 4.5 },
    { fg: 'text-muted', bg: 'raised', min: 4.5 },
    { fg: 'on-violet', bg: 'violet', min: 4.5 },
    { fg: 'on-violet', bg: 'violet-hover', min: 4.5 },
    { fg: 'violet-light', bg: 'ground', min: 4.5 },
    { fg: 'violet-light', bg: 'surface', min: 4.5 },
    { fg: 'gold-text', bg: 'ground', min: 4.5 },
    { fg: 'gold-text', bg: 'surface', min: 4.5 },
    { fg: 'gold-ink', bg: 'gold', min: 4.5 },
    { fg: 'easy', bg: 'surface', min: 4.5, chip: true },
    { fg: 'medium', bg: 'surface', min: 4.5, chip: true },
    { fg: 'hard', bg: 'surface', min: 4.5, chip: true },
    { fg: 'success', bg: 'surface', min: 4.5 },
    { fg: 'danger', bg: 'surface', min: 4.5 },
    { fg: 'warning', bg: 'surface', min: 4.5 },
    { fg: 'rarity-common', bg: 'surface', min: 4.5 },
    { fg: 'rarity-rare', bg: 'surface', min: 4.5 },
    { fg: 'rarity-epic', bg: 'surface', min: 4.5 },
    { fg: 'rarity-legendary', bg: 'surface', min: 4.5 },
    { fg: 'flame', bg: 'surface', min: 3 },
    { fg: 'frost', bg: 'surface', min: 3 },
    { fg: 'border-strong', bg: 'surface', min: 1.3 },
  ];
