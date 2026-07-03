# Ember Finance — "Ember Terminal" Design System (v2.0)

**This file is the single source of truth for the v2 UI rebuild. Every page and component
must follow it exactly. Do not reference or imitate any pre-v2 styling.**

## Thesis

A professional dark trading terminal where the Ember identity reads as **heat in the data**,
not decoration. The canvas is warm near-black (charcoal with ember undertones — never
blue/slate). Heat = attention: the more important or active something is, the warmer it gets.
Ember orange is scarce; when it appears, it means something.

## Tokens (already defined in `client/src/index.css` via Tailwind v4 `@theme`)

Use these as Tailwind utilities (`bg-surface-1`, `text-ink-2`, `border-line`, `text-up`…).
Never hardcode hex values in JSX; never use Tailwind palette colors (`zinc-*`, `slate-*`,
`emerald-*`, `rose-*`, `amber-*`, `white/N`) — they are the old system and are banned.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0807` | App canvas |
| `surface-1` | `#14110E` | Panels, cards |
| `surface-2` | `#1B1713` | Nested/raised surfaces, inputs |
| `surface-3` | `#262019` | Hover fills, active rows |
| `line` | `rgba(244,232,216,0.08)` | Hairline borders |
| `line-strong` | `rgba(244,232,216,0.16)` | Emphasized borders, dividers |
| `ink` | `#F4EFE9` | Primary text (warm white) |
| `ink-2` | `#B5AB9F` | Secondary text |
| `ink-3` | `#837A6F` | Faint text, placeholders |
| `ember` | `#FF6B2C` | Brand accent — CTAs, active nav, key highlights ONLY |
| `flame` | `#FFA53D` | Gradient partner of ember; small glows |
| `ember-deep` | `#C2410C` | Pressed states, deep gradient stop |
| `up` | `#3DDC97` | Positive change |
| `down` | `#FF6161` | Negative change |
| `warn` | `#FFC24B` | Warnings, pending states |

Brand gradient: `linear-gradient(135deg, #FF6B2C, #FFA53D)` — available as class `.bg-ember-grad`.

## Typography (editorial serif — big titles, small compact body)

- **Display / titles:** `font-display` → Instrument Serif. Large and editorial; `.display`
  (regular weight, −0.01em tracking, 1.02 leading). Make titles big — the type is the hero.
- **Body / UI:** `font-sans` → Newsreader (a refined, Times-lineage serif). Kept SMALL and
  compact: base 14px, line-height 1.45. The document/manuscript feel is intentional.
- **Labels & numerals:** `font-mono` → JetBrains Mono. `.eyebrow` is mono (10px uppercase,
  0.22em tracking) for crisp contrast against the serif. Every number is `.num` (mono).
- Strong hierarchy: big serif title, small serif body, mono labels/data.

## Finish: frosted glass

Surfaces are GLASS, not solid. Panels, tables, ghost buttons and inputs are translucent
warm-dark fills with `backdrop-filter: blur(...)` and a faint top highlight — they frost
whatever sits behind them. The primary button is a glassy ember gradient with a sheen (not a
flat solid fill). On the Welcome page a live `MarketBackdrop` stock-chart canvas drifts and
parallaxes on scroll behind the glass. Keep blur modest and reduced-motion respected so it
stays smooth on any device; don't stack `backdrop-filter` on many tiny elements (chips use a
plain translucent fill, sticky table headers use a near-opaque fill instead of blur).

## Component classes (defined in index.css — use them, don't reinvent)

| Class | What it is |
|---|---|
| `.panel` | Card: surface-1, 1px line border, rounded-xl (14px) |
| `.panel-hover` | Adds warm hover: border warms toward ember/25, subtle lift shadow |
| `.panel-pad` | Standard card padding (p-4 sm:p-5) |
| `.eyebrow` | Uppercase expanded micro-label |
| `.display` | Display heading treatment (use with text-2xl/3xl/4xl) |
| `.num` | Tabular mono numerals |
| `.btn` | Base button (height, radius, focus ring, transitions) |
| `.btn-primary` | Ember gradient CTA, dark text, warm glow on hover |
| `.btn-ghost` | Quiet bordered button |
| `.btn-danger` | Destructive |
| `.input`, `.select` | Form fields on surface-2, ember focus ring |
| `.field-label` | Small label above fields |
| `.chip` | Small rounded tag; variants `.chip-up`, `.chip-down`, `.chip-ember`, `.chip-warn` |
| `.tbl` | Table wrapper: apply to a `<div>` around `<table>`; styles sticky header, hairline rows, row hover (surface-3), `.num` cells right-aligned |
| `.ember-rule` | **Signature.** 1px molten gradient hairline (ember→flame→transparent) with a slow breathing shimmer. Place under page headers and above key panels. Use 1–2 per screen, no more. |
| `.rise` + `.rise-1`…`.rise-12` | Staggered page-enter reveal (fade + 8px up, 400ms). Add to top-level sections in DOM order |
| `.skeleton` | Loading shimmer block |
| `.ignite` | One-shot warm pulse for a value that just updated |
| `.kbd` | Keyboard shortcut hint |
| `.scroll-thin` | Slim warm scrollbar |
| `.glass` | Translucent surface-1/80 + blur, for sticky bars & overlays |

## Page anatomy (every app page)

```
<header className="rise">
  <p className="eyebrow">SECTION · CONTEXT</p>        ← eyebrow states what data this is
  <h1 className="display text-2xl sm:text-3xl">Title</h1>
  <div className="ember-rule mt-4" />
</header>
<section className="rise rise-2">…panels…</section>
```

- Page container width comes from Layout — pages never set their own max-width.
- Grid gaps: `gap-4` (16px) standard, `gap-3` in dense areas. Section spacing `mt-6`/`mt-8`.
- Empty states: icon (lucide, size-8, ink-3) + one plain sentence + one action button.
  They invite action, never apologize.
- Errors: say what failed and how to retry. No "Oops".

## Motion (refined & restrained)

- Enter: `.rise` stagger only. Never animate on scroll inside the app (marketing pages may
  use RevealOnScroll).
- Micro: 150–250ms, `cubic-bezier(0.22,1,0.36,1)`. Hover = color/border/shadow only —
  **no scale transforms that shift layout**.
- Numbers: use existing `AnimatedNumber` component for KPI count-ups.
- Everything gated behind `@media (prefers-reduced-motion: reduce)` — the CSS layer already
  handles this for `.rise`, `.ember-rule`, `.ignite`, `.skeleton`.

## Data color rules

- Green/red ONLY for direction/deltas. Neutral values are `ink`/`ink-2`.
- Up/down text pairs with a small triangle glyph (▲▼ as SVG or lucide `TrendingUp`) — color
  is never the only indicator.
- Charts: recharts/lightweight-charts use `#3DDC97`/`#FF6161`, grid lines `rgba(244,232,216,0.06)`,
  text `#837A6F`, ember `#FF6B2C` reserved for the primary series or selection.
  Chart theme is always dark: `useChartTheme()` returns 'dark'.

## Hard rules

1. No emojis as icons — lucide-react only, consistent `size-4`/`size-5`.
2. `cursor-pointer` on everything clickable.
3. Visible focus: all interactive elements get the ember focus ring (`.btn`/`.input` have it;
   for custom elements use `focus-visible:ring-2 focus-visible:ring-ember/60 outline-none`).
4. Touch targets ≥ 44px on mobile (pad hit areas, not glyphs).
5. Responsive at 375 / 768 / 1024 / 1440. Tables scroll inside `.tbl` (`overflow-x-auto`),
   never the page.
6. Preserve ALL existing logic: hooks, fetches, state, handlers, routes, localStorage keys,
   component export names and prop APIs. This is a reskin at the JSX/class level only.
7. Copy: sentence case, active voice, verbs on buttons ("Save changes", "Add alert").
   Consistent vocabulary across pages.
8. No new dependencies. React 19 + Tailwind v4 + lucide-react + recharts + lightweight-charts.
9. Old-brand effect components (ClickSparkProvider, EmberParticles, FireSpirit, useEmberBurst,
   useFireMotionEnabled) are retired — remove their usage from files you own.
