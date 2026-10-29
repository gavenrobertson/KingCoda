# KingCoda — Design system ("Night Court")

Source of truth: the **KingCoda** design canvas (artboards: Problems, Problem workspace, Store, Profile, Leaderboard, Brand & tokens, Weekly recap share card). This file turns that canvas into implementation tokens for `packages/ui`. When they disagree, the canvas wins; update this file to match.

> Violet means act. Gold means you earned something.

## Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | Bricolage Grotesque (opsz 12–96) | 500–800, headings at 750 | Page titles, verdict headline ("Accepted."), big numbers (rank, streak, recap) |
| UI / prose | Geist | 400–700 | Interface, problem statements |
| Mono | JetBrains Mono | 400, 500, 700 | Code, stats, XP counts, shortcuts, gold amounts |

Base: 14px / 1.5 UI text. Display letter-spacing −0.02 to −0.04em. Section labels: 12px, 700, uppercase, 0.08em tracking, muted.

## Color tokens — dark (default)

| Token | Hex | Use |
|---|---|---|
| `--ground` | `#0B0D14` | Page background |
| `--surface` | `#121521` | Cards, panels |
| `--surface-sunken` | `#10131D` | Tables, console |
| `--raised` | `#181C2A` | Secondary buttons, inputs |
| `--hover` | `#161A28` / `#1C2131` | Row hover / ghost button hover |
| `--border` | `#232838` | Default borders |
| `--border-subtle` | `#1E2333` | Header divider, row dividers |
| `--border-strong` | `#2E3448` | Outlines, inactive rings |
| `--text` | `#ECEEF5` | Primary text |
| `--text-muted` | `#A3AABD` | Secondary text (passes AA on ground and surface) |
| `--text-faint` | `#5B6278` | Locked/disabled icons only. **Not for text** (fails AA) |

### Brand & reward

| Token | Hex | Use |
|---|---|---|
| `--violet` | `#6A57F5` | Primary actions (Submit), logo tile, focus brand |
| `--violet-hover` | `#7A68FF` | Primary hover |
| `--violet-light` | `#A79BFF` | Links, focus ring (2px, offset 2px) |
| `--violet-tint` | `#2B2550` / `#1A1733` | Avatar fill, selected chips |
| `--gold` | `#FFC94A` | XP, gold, level, crown, "you earned something" |
| `--gold-ink` | `#1A1406` | Text on gold buttons |
| `--gold-deep` | `#B9811F` | Coin engraving |
| `--gold-flash` | `#FFF1C2` | XP gain segment flash, 30+ flame core |
| `--flame` | `#FF9F43` | Streak flame, "today" ring |
| `--frost` | `#7DD3FC` | Streak freeze |

### Difficulty (identical everywhere: list, workspace, profile, recap)

| Level | Foreground | Chip background |
|---|---|---|
| Easy | `#2DD4A7` | `rgba(45,212,167,0.14)` |
| Medium | `#F5B544` | `rgba(245,181,68,0.14)` |
| Hard | `#FF6B81` | `rgba(255,107,129,0.14)` |

The three sit at different lightness, so they still read in grayscale.

### Verdicts

| Verdict | Color | Tone |
|---|---|---|
| Accepted | `#2DD4A7` | Celebrate |
| Wrong Answer | `#FF8A9C` | Show the diff, offer a hint |
| Time Limit Exceeded | `#F5B544` | Point at complexity |
| Memory Limit Exceeded | `#F5B544` | Point at data structures |
| Runtime Error | `#FF8A9C` | Show the trace line |
| Compile Error | `#A3AABD` | Jump to the line |

### Store rarity (kept off the difficulty hues)

Common `#A3AABD` · Rare `#6CB4FF` · Epic `#B9AEFF` · Legendary `#FFC94A`

### Rank change

Up `#2DD4A7` ▲ · Down `#FF8A9C` ▼ · No change `#A3AABD` —. Every arrow carries an `aria-label` ("up 3").

### Heatmap scale

`#181C29` → `#2F2862` → `#4A3CB0` → `#6E5DF7` → `#B3A8FF`

## Color tokens — light

The canvas is dark only. Phase 1 derives a light theme with these rules, then checks every pair with a contrast script in CI (WCAG AA: 4.5:1 text, 3:1 large text and UI):

- Ground `#F7F7FB`, surface `#FFFFFF`, raised `#F0F0F6`, border `#E2E3EC`, text `#14151C`, muted `#565C70`.
- Brand violet darkens to `#5442E0` (already on the canvas's light logo tile) for AA on white.
- Gold as *text* on light becomes `#8A5A00`; gold fills stay `#FFC94A` with `--gold-ink` text.
- Difficulty foregrounds darken (Easy `#087A5E`, Medium `#9A6200`, Hard `#C8314C`) at the same chip-tint alpha.

## Shape & spacing

- Radii: buttons/inputs 10px; chips 99px; cards 16–18px; logo tile 8/28 of its size; recap cards 24px.
- Control heights: 34px (segmented), 36–40px (buttons), 44px (minimum touch target for primary controls).
- Spacing scale: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 56, 64.
- Page container: max-width 1120px (leaderboard), 24px side padding; 16px on phones.

## Components seen on the canvas

Header (logo, primary nav with gold underline for current page, Ctrl K search, gold chip, streak flame, level/XP bar, avatar with frame) · difficulty chip · tag chip · segmented control (`aria-pressed`) · problem table with status icons (solved / attempted / todo) and Daily marker · daily challenge card with countdown and week dots · study plan progress bars · podium cards · ranked rows with pinned "You" row · verdict panel (Accepted / WA with diff) · runtime and memory distribution bars (yours in gold or violet-light) · hint cards (locked/unlocked) · XP gain toast · badge unlock toast · badge grid with locked silhouettes · contribution heatmap · language breakdown bars · Store item cards (rarity border, price, owned/equipped/locked/short states) · equipped-look preview · weekly recap share card · mobile "editor is built for a bigger screen" card.

## Motion

- Hover/press: 120 ms ease-out; press scales to 0.98.
- XP bar: gain segment appears in `--gold-flash`, holds 400 ms and settles into gold over 600 ms.
- Accepted burst: ≤ 1.2 s, skippable. Reduced motion → static gold glow, no particles, numbers jump to final.
- Skeletons match final dimensions exactly (no layout shift).

## Iconography

Inline stroke SVGs (2px, round caps), no emoji. Crown mark: violet tile + gold crown. Flame has 3 growth stages: 1–6 days (dim `#C97A3A`), 7–29 (flame with gold core), 30+ (pale-gold core + glow).
