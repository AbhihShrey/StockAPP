/**
 * Ember Finances version history — the single source of truth for the app version.
 *
 * Both the Settings → About "Version" line and the Settings → "Version history" card read from
 * here, so they can never drift. Newest release first; CURRENT_VERSION is the top entry.
 *
 * Versioning convention (bump the part that matches the size of the release):
 *   • patch (x.y.+1) — small fixes / tweaks
 *   • minor (x.+1.0) — a new feature or notable improvement
 *   • major (+1.0.0) — a large release or overhaul
 *
 * On every deploy, add a new entry at the top: a one-line `summary` plus the detailed `changes`.
 */

/** @typedef {{ version: string, date: string, type: 'major'|'minor'|'patch', title: string, summary: string, changes: string[] }} Release */

/** @type {Release[]} */
export const VERSION_HISTORY = [
  {
    version: '1.4.0',
    date: 'Jul 2026',
    type: 'minor',
    title: 'New logo: flame + rising arrow',
    summary: 'The brand mark is now a two-tongue flame with a rising chart arrow cut through its core.',
    changes: [
      'Flame silhouette with two tips and a jagged valley, orange-to-red gradient, warm cream core.',
      'A dark zigzag chart arrow rises through the mark, ending in a bold arrowhead.',
      'Wordmark is now lowercase “emberfinances” — “ember” in orange, “finances” in white.',
      'Favicon and brand SVGs updated to match.',
    ],
  },
  {
    version: '1.3.1',
    date: 'Jul 2026',
    type: 'patch',
    title: 'Logo, blended',
    summary: 'The new mark is now one fused, all-warm candle — flame, molten rim, and body melt together.',
    changes: [
      'Dropped the green candle body; the whole mark now lives in a single ember palette.',
      'The flame base sinks into the candle’s molten top, so nothing floats or clashes.',
      'Brighter cream core at the junction bridges fire and wax.',
      'Favicon and brand SVGs updated to match.',
    ],
  },
  {
    version: '1.3.0',
    date: 'Jul 2026',
    type: 'minor',
    title: 'New brand mark',
    summary: 'A redesigned logo: the Ember flame igniting a green up-candle, in the app’s own accent colors.',
    changes: [
      'New icon mark — a chart candlestick whose upper wick is the Ember flame, with a glowing inner core.',
      'The candle body uses the app’s mint accent, tying the brand to the UI palette.',
      'Refreshed wordmark: “Ember” bold, “Finances” light, tighter letterspacing.',
      'Matching favicon and brand SVGs.',
    ],
  },
  {
    version: '1.2.1',
    date: 'Jul 2026',
    type: 'patch',
    title: 'Expandable changelog',
    summary: 'Version history entries now expand — click any release to see exactly what changed.',
    changes: [
      'Each release shows a one-line summary, with the full details a click away.',
      'The latest version is expanded by default.',
    ],
  },
  {
    version: '1.2.0',
    date: 'Jul 2026',
    type: 'minor',
    title: 'Screener refinements',
    summary: 'Sharper, more tradeable screener results — plus a cache that survives restarts.',
    changes: [
      'Liquidity filter — skip penny / thinly-traded names so every result is tradeable.',
      'Earnings flags — matched names reporting soon are marked so a setup can’t surprise you.',
      'Readiness score weights are now tunable without a code change.',
      'Scan and price-history caches persist across restarts (faster after each update).',
      'Added this version history.',
    ],
  },
  {
    version: '1.1.0',
    date: 'Jul 2026',
    type: 'minor',
    title: 'Strategy-proximity screener',
    summary: 'Find stocks approaching a strategy target, ranked by how ready they are to trigger.',
    changes: [
      'New Screener page: find stocks approaching a strategy target (VWAP, MA crossover, 52-week high/low, moving averages, RSI, Bollinger, round numbers, gap fills, opening range).',
      'Only surfaces names with real momentum toward the level, ranked by a readiness score.',
      'Set proximity alerts per symbol or for a whole screen.',
      'The classic filter screener moved into its own page.',
    ],
  },
  {
    version: '1.0.0',
    date: 'Jun 2026',
    type: 'major',
    title: 'Ember Finances launch',
    summary: 'The first Ember Finances release.',
    changes: [
      'Dashboard, Markets, Watchlist, Sectors, News, Insider Activity, and Technical Analysis.',
      'Accounts with email verification, password reset, and two-factor authentication.',
      'Price and VWAP alerts with email and in-app delivery.',
    ],
  },
]

export const CURRENT_VERSION = VERSION_HISTORY[0].version
