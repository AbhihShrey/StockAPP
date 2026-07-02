/**
 * Options / gamma data provider abstraction (Phase 2).
 *
 * The current FMP plan exposes NO options chains or gamma data, so the
 * `gamma_levels` screener strategy (call wall / put support) is disabled. This
 * module defines the seam a real provider (Polygon.io, Tradier, ORATS, Unusual
 * Whales, …) will implement, so wiring one in later touches only this file.
 *
 * A provider returns, for a symbol:
 *   { callWall: number|null, putSupport: number|null, asOf: string, source: string }
 * where callWall is the nearest large-gamma resistance strike above spot and
 * putSupport the nearest large-gamma support strike below spot.
 */

export class OptionsNotConfiguredError extends Error {
  constructor(message = 'Options data provider is not configured (Phase 2).') {
    super(message)
    this.name = 'OptionsNotConfiguredError'
    this.code = 'OPTIONS_NOT_CONFIGURED'
  }
}

/** Null provider — active until a real options source is wired in. */
export const NullOptionsProvider = {
  isConfigured() {
    return false
  },
  async getGammaLevels() {
    throw new OptionsNotConfiguredError()
  },
}

let activeProvider = NullOptionsProvider

/** Swap in a real provider in Phase 2. */
export function setOptionsProvider(provider) {
  activeProvider = provider ?? NullOptionsProvider
}

export function isOptionsConfigured() {
  return Boolean(activeProvider?.isConfigured?.())
}

export async function getGammaLevels(symbol) {
  return activeProvider.getGammaLevels(symbol)
}
