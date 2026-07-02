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
 * On every deploy, add a new entry at the top describing what changed.
 */

/** @typedef {{ version: string, date: string, type: 'major'|'minor'|'patch', title: string, changes: string[] }} Release */

/** @type {Release[]} */
export const VERSION_HISTORY = [
  {
    version: '1.2.0',
    date: 'Jul 2026',
    type: 'minor',
    title: 'Screener refinements',
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
    changes: [
      'Dashboard, Markets, Watchlist, Sectors, News, Insider Activity, and Technical Analysis.',
      'Accounts with email verification, password reset, and two-factor authentication.',
      'Price and VWAP alerts with email and in-app delivery.',
    ],
  },
]

export const CURRENT_VERSION = VERSION_HISTORY[0].version
