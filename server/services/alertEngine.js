import cron from 'node-cron'
import { fetchBatchQuotesBySymbols, fmpGet } from './fmp.js'
import {
  ORHL_CONDITIONS,
  getActiveAlerts,
  getTodayAlertHistory,
  getUsersForDigest,
  loadActiveAlertPositions,
  recordAlertFired,
  updateAlertPosition,
} from './alertService.js'
import { refreshEarningsDates, runEarningsCheck } from './earningsAlerts.js'
import { getWatchlistSymbols } from './watchlistService.js'
import { isEmailConfigured, sendAlertEmail, sendDailyDigestEmail } from './emailService.js'

let wsBroadcast = null

// In-memory crossing-state maps — populated from DB at startup and kept live during the session.
// 'above' | 'below' — undefined key means first observation (no signal emitted yet).
const vwapPositionMap  = new Map() // alertId -> 'above' | 'below'
const orhlPositionMap  = new Map()
const pricePositionMap = new Map() // used by both intraday and swing price alerts

export function setWsBroadcast(fn) {
  wsBroadcast = fn
}

export function broadcastToUser(userId, payload) {
  if (!wsBroadcast) return false
  try {
    return Boolean(wsBroadcast(userId, payload))
  } catch {
    return false
  }
}

function isWeekday() {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    .format(new Date())
  return wd !== 'Sat' && wd !== 'Sun'
}

function isMarketHours() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const wd = parts.find((p) => p.type === 'weekday')?.value
  if (wd === 'Sat' || wd === 'Sun') return false
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const mins = hh * 60 + mm
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

/** Returns minutes since midnight in ET — used for the time-window gate. */
function getEtMinutes() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hh * 60 + mm
}

const IGNORE_RTH = () => String(process.env.ALERTS_IGNORE_MARKET_HOURS ?? '').trim() === '1'

/** Returns true if this specific alert should be evaluated right now. */
function shouldRunAlert() {
  if (IGNORE_RTH()) return true
  return isMarketHours()
}

/** Swing checks run any weekday — they use daily/aftermarket quotes, not intraday bars. */
function shouldRunSwingChecks() {
  if (String(process.env.ALERTS_IGNORE_MARKET_HOURS ?? '').trim() === '1') return true
  return isWeekday()
}

function todayEtPrefix() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

// 55-second bar cache so all conditions for the same symbol share one FMP call per minute
const barCache = new Map() // symbol -> { bars, fetchedAt }
const BAR_CACHE_TTL_MS = 55_000

export async function fetchTodayBars(symbol) {
  const cached = barCache.get(symbol)
  if (cached && Date.now() - cached.fetchedAt < BAR_CACHE_TTL_MS) return cached.bars

  try {
    const raw = await fmpGet('/historical-chart/1min', { symbol })
    const today = todayEtPrefix()
    const bars = (Array.isArray(raw) ? raw : [])
      .filter((b) => String(b.date ?? '').startsWith(today))
      .reverse() // oldest-first (FMP returns newest-first)
    barCache.set(symbol, { bars, fetchedAt: Date.now() })
    return bars
  } catch {
    return []
  }
}

/** Fetch 1-min bars for an arbitrary ET date (uses live cache when date is today). */
export async function fetchBarsForDate(symbol, etDateStr) {
  if (etDateStr === todayEtPrefix()) return fetchTodayBars(symbol)
  try {
    const raw = await fmpGet('/historical-chart/1min', { symbol })
    return (Array.isArray(raw) ? raw : [])
      .filter((b) => String(b.date ?? '').startsWith(etDateStr))
      .reverse()
  } catch {
    return []
  }
}

function calcVwap(bars) {
  let sumPV = 0, sumV = 0
  for (const b of bars) {
    const h = Number(b.high ?? b.close), l = Number(b.low ?? b.close), c = Number(b.close)
    if (!Number.isFinite(c)) continue
    const tp = (h + l + c) / 3
    const vol = Math.max(Number(b.volume) || 1, 1)
    sumPV += tp * vol
    sumV += vol
  }
  return sumV > 0 ? sumPV / sumV : null
}

// Returns { high, low } for the first openingMinutes of the session, or null
function calcOrhl(bars, openingMinutes) {
  if (bars.length === 0) return null

  const cutoffMinutes = 9 * 60 + 30 + openingMinutes

  const sessionBars = bars.filter((b) => {
    const [, timePart] = (b.date ?? '').split(' ')
    if (!timePart) return false
    const [hh, mm] = timePart.split(':').map(Number)
    const totalMins = hh * 60 + mm
    return totalMins >= 9 * 60 + 30 && totalMins < cutoffMinutes
  })

  if (sessionBars.length === 0) return null

  // Opening range period must have fully elapsed before firing
  const [, lastTimePart] = (sessionBars[sessionBars.length - 1]?.date ?? '').split(' ')
  const [lastHh, lastMm] = (lastTimePart ?? '00:00').split(':').map(Number)
  if (lastHh * 60 + lastMm < cutoffMinutes - 1) return null

  let high = -Infinity, low = Infinity
  for (const b of sessionBars) {
    const h = Number(b.high ?? b.close)
    const l = Number(b.low ?? b.close)
    if (Number.isFinite(h) && h > high) high = h
    if (Number.isFinite(l) && l < low) low = l
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null
  return { high, low }
}

/**
 * Volume gate: returns true if the most-recent completed bar's volume is at least
 * minMult × the session average bar volume. Returns true (pass) when minMult is null.
 */
function passesVolumeGate(bars, minMult) {
  if (minMult == null || bars.length < 2) return true
  const totalVol = bars.reduce((s, b) => s + Math.max(Number(b.volume) || 0, 0), 0)
  const avgVol = totalVol / bars.length
  if (avgVol === 0) return true
  const recentVol = Math.max(Number(bars[bars.length - 1]?.volume) || 0, 0)
  return recentVol >= avgVol * minMult
}

/** Persist position and update in-memory map, writing to DB only when the value changes. */
function setPosition(map, alertId, newPos) {
  const prev = map.get(alertId)
  map.set(alertId, newPos)
  if (prev !== newPos) updateAlertPosition(alertId, newPos)
  return prev
}

function fireBroadcast(alert, sym, price, vwapAtTrigger) {
  try {
    recordAlertFired(alert.id, alert.user_id, {
      symbol: sym,
      condition: alert.condition,
      threshold: alert.threshold,
      triggeredPrice: price,
      vwapAtTrigger,
    })

    const payload = {
      type: 'alert_fired',
      alertId: alert.id,
      symbol: sym,
      condition: alert.condition,
      threshold: alert.threshold,
      triggeredPrice: price,
      vwapAtTrigger,
      triggeredAt: Math.floor(Date.now() / 1000),
      alertType: alert.alert_type ?? 'intraday',
    }

    if (wsBroadcast) wsBroadcast(alert.user_id, payload)

    if (alert.email_alerts_enabled === 1 && isEmailConfigured()) {
      const deliveryEmail = alert.alert_email || alert.email
      if (deliveryEmail) {
        sendAlertEmail(deliveryEmail, {
          symbol: sym, condition: alert.condition,
          threshold: alert.threshold, triggeredPrice: price, vwapAtTrigger,
        }).catch((err) => console.error('[alerts] email send error:', err.message))
      }
    }

    console.log(`[alerts] ${sym} ${alert.condition} fired at $${price.toFixed(2)} (${alert.alert_type ?? 'intraday'}, user ${alert.user_id})`)
  } catch (err) {
    console.error('[alerts] recordAlertFired error:', err.message)
  }
}

// ── Intraday alert check (every 30s during RTH) ───────────────────────────────

export async function runAlertCheck() {
  if (!IGNORE_RTH() && !isMarketHours()) return

  const allAlerts = getActiveAlerts('intraday')
  if (allAlerts.length === 0) return

  const alerts = allAlerts.filter(shouldRunAlert)
  if (alerts.length === 0) return

  const symbols = [...new Set(alerts.map((a) => a.symbol.toUpperCase()))]

  const barSymbols = [...new Set(
    alerts
      .filter((a) =>
        a.condition.startsWith('vwap') ||
        ORHL_CONDITIONS.includes(a.condition) ||
        a.min_volume_mult != null,
      )
      .map((a) => a.symbol.toUpperCase()),
  )]

  let quoteMap
  try {
    ;[quoteMap] = await Promise.all([
      fetchBatchQuotesBySymbols(symbols),
      ...barSymbols.map((sym) => fetchTodayBars(sym)),
    ])
  } catch (err) {
    // Transient network failure — skip this tick silently
    if (err instanceof TypeError || err?.name === 'AbortError' || err?.name === 'TimeoutError') return
    throw err
  }

  const etMins = getEtMinutes()
  const SESSION_OPEN = 9 * 60 + 30

  for (const alert of alerts) {
    const sym = alert.symbol.toUpperCase()
    const quote = quoteMap.get(sym)
    if (!quote?.price) continue
    const price = quote.price

    // ── Gate 1: time-of-day window ────────────────────────────────────────────
    if (alert.time_window_minutes != null) {
      if (etMins < SESSION_OPEN || etMins >= SESSION_OPEN + alert.time_window_minutes) continue
    }

    // ── Gate 2: volume confirmation ───────────────────────────────────────────
    if (alert.min_volume_mult != null) {
      const bars = await fetchTodayBars(sym)
      if (!passesVolumeGate(bars, alert.min_volume_mult)) continue
    }

    // ── Gate 3: condition + crossing detection ────────────────────────────────
    let fired = false
    let vwapAtTrigger = null

    if (alert.condition === 'vwap_above' || alert.condition === 'vwap_below') {
      const bars = await fetchTodayBars(sym)
      if (bars.length < 3) continue
      const vwap = calcVwap(bars)
      if (vwap == null) continue
      vwapAtTrigger = vwap

      const currentPos = price > vwap ? 'above' : 'below'
      const prevPos = setPosition(vwapPositionMap, alert.id, currentPos)
      if (prevPos === undefined) continue

      fired = alert.condition === 'vwap_above'
        ? prevPos === 'below' && currentPos === 'above'
        : prevPos === 'above' && currentPos === 'below'

    } else if (alert.condition === 'price_above' || alert.condition === 'price_below') {
      const bufPct = alert.buffer_pct != null ? Number(alert.buffer_pct) : 0
      const effectiveThreshold = alert.condition === 'price_above'
        ? alert.threshold * (1 + bufPct / 100)
        : alert.threshold * (1 - bufPct / 100)

      const currentPos = alert.condition === 'price_above'
        ? (price >= effectiveThreshold ? 'above' : 'below')
        : (price <= effectiveThreshold ? 'below' : 'above')

      const prevPos = setPosition(pricePositionMap, alert.id, currentPos)
      if (prevPos === undefined) continue

      fired = alert.condition === 'price_above'
        ? prevPos === 'below' && currentPos === 'above'
        : prevPos === 'above' && currentPos === 'below'

    } else if (ORHL_CONDITIONS.includes(alert.condition)) {
      const bars = await fetchTodayBars(sym)
      const orhl = calcOrhl(bars, Number(alert.threshold))
      if (!orhl) continue

      const currentPos = alert.condition === 'orhl_above'
        ? (price > orhl.high ? 'above' : 'below')
        : (price < orhl.low  ? 'below' : 'above')
      const prevPos = setPosition(orhlPositionMap, alert.id, currentPos)
      if (prevPos === undefined) continue

      fired = alert.condition === 'orhl_above'
        ? prevPos === 'below' && currentPos === 'above'
        : prevPos === 'above' && currentPos === 'below'
    }

    if (!fired) continue
    fireBroadcast(alert, sym, price, vwapAtTrigger)
  }
}

// ── Swing / long-term alert check (every 5 min, all weekdays including AH) ───

export async function runSwingCheck() {
  if (!shouldRunSwingChecks()) return

  const alerts = getActiveAlerts('swing')
  if (alerts.length === 0) return

  const symbols = [...new Set(alerts.map((a) => a.symbol.toUpperCase()))]
  let quoteMap
  try {
    quoteMap = await fetchBatchQuotesBySymbols(symbols)
  } catch (err) {
    if (err instanceof TypeError || err?.name === 'AbortError' || err?.name === 'TimeoutError') return
    throw err
  }

  for (const alert of alerts) {
    const sym = alert.symbol.toUpperCase()
    const quote = quoteMap.get(sym)
    if (!quote?.price) continue
    const price = quote.price

    if (alert.condition !== 'price_above' && alert.condition !== 'price_below') continue

    const bufPct = alert.buffer_pct != null ? Number(alert.buffer_pct) : 0
    const effectiveThreshold = alert.condition === 'price_above'
      ? alert.threshold * (1 + bufPct / 100)
      : alert.threshold * (1 - bufPct / 100)

    const currentPos = alert.condition === 'price_above'
      ? (price >= effectiveThreshold ? 'above' : 'below')
      : (price <= effectiveThreshold ? 'below' : 'above')

    const prevPos = setPosition(pricePositionMap, alert.id, currentPos)
    if (prevPos === undefined) continue

    const fired = alert.condition === 'price_above'
      ? prevPos === 'below' && currentPos === 'above'
      : prevPos === 'above' && currentPos === 'below'

    if (!fired) continue
    fireBroadcast(alert, sym, price, null)
  }
}

async function sendDailyDigests() {
  if (!isWeekday() || !isEmailConfigured()) return

  const users = getUsersForDigest()
  if (users.length === 0) return

  const marketSymbols = ['SPY', 'QQQ', 'IWM', 'DIA']
  const quoteMap = await fetchBatchQuotesBySymbols(marketSymbols)
  const marketSummary = marketSymbols
    .map((sym) => {
      const q = quoteMap.get(sym)
      return q ? { symbol: sym, price: q.price, changePercent: q.changePercent } : null
    })
    .filter(Boolean)

  for (const user of users) {
    try {
      const alertsFired = getTodayAlertHistory(user.id)

      const wlRows = getWatchlistSymbols(user.id)
      let watchlistMovers = []
      if (wlRows.length > 0) {
        const wlSymbols = wlRows.map((r) => r.symbol)
        const wlQuotes = await fetchBatchQuotesBySymbols(wlSymbols)
        watchlistMovers = wlSymbols
          .map((sym) => {
            const q = wlQuotes.get(sym.toUpperCase())
            return q ? { symbol: sym, price: q.price, changePercent: q.changePercent } : null
          })
          .filter((q) => q && Math.abs(q.changePercent ?? 0) >= 1.5)
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
          .slice(0, 8)
      }

      await sendDailyDigestEmail(user.deliveryEmail, { marketSummary, alertsFired, watchlistMovers })
      console.log(`[digest] Sent daily digest to user ${user.id}`)
    } catch (err) {
      console.error(`[digest] Failed for user ${user.id}:`, err.message)
    }
  }
}

export function startAlertEngine() {
  // Restore crossing state from DB so restarts don't cause spurious first-tick signals
  const today = todayEtPrefix()
  const rows = loadActiveAlertPositions()
  for (const row of rows) {
    const isSessionBased = row.condition.startsWith('vwap') || row.condition.startsWith('orhl')
    if (isSessionBased && row.last_position_date !== today) continue

    if (row.condition === 'vwap_above' || row.condition === 'vwap_below') {
      vwapPositionMap.set(row.id, row.last_position)
    } else if (row.condition === 'orhl_above' || row.condition === 'orhl_below') {
      orhlPositionMap.set(row.id, row.last_position)
    } else if (row.condition === 'price_above' || row.condition === 'price_below') {
      pricePositionMap.set(row.id, row.last_position)
    }
  }
  console.log(`[alerts] Restored ${rows.length} persisted crossing state(s) from DB`)

  const ignoreRth = IGNORE_RTH()

  if (ignoreRth) console.warn('[alerts] ALERTS_IGNORE_MARKET_HOURS=1 — intraday checks run 24/7 (testing only)')

  // Intraday: every 30s on weekdays (gates enforced per-alert inside runAlertCheck)
  const intradayCron = ignoreRth ? '*/30 * * * * *' : '*/30 * * * * 1-5'
  cron.schedule(intradayCron, () => {
    runAlertCheck().catch((err) => console.error('[alerts] intraday engine error:', err.message))
  })

  // Swing: every 5 minutes on weekdays (runs all day, uses aftermarket quotes when available)
  cron.schedule('*/5 * * * 1-5', () => {
    runSwingCheck().catch((err) => console.error('[alerts] swing engine error:', err.message))
  })

  // Daily digest: 4:30 PM ET on weekdays
  cron.schedule('30 16 * * 1-5', () => {
    sendDailyDigests().catch((err) => console.error('[digest] cron error:', err.message))
  }, { timezone: 'America/New_York' })

  // Earnings alerts: fire at 8:00 AM ET on weekdays for any alert whose
  // stored earnings_date matches today.
  cron.schedule('0 8 * * 1-5', () => {
    runEarningsCheck({ force: true, broadcast: wsBroadcast })
      .catch((err) => console.error('[earnings] cron error:', err.message))
  }, { timezone: 'America/New_York' })

  // Daily refresh: re-fetch earnings dates so reschedules surface badges.
  cron.schedule('15 6 * * *', () => {
    refreshEarningsDates().catch((err) => console.error('[earnings] refresh error:', err.message))
  }, { timezone: 'America/New_York' })

  // First-app-open semantic: if the server boots after 8:00 AM ET on a weekday,
  // run the check once so any "today" alerts that missed the 8 AM cron still fire.
  setTimeout(() => {
    const now = new Date()
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now)
    if (wd === 'Sat' || wd === 'Sun') return
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = fmt.formatToParts(now)
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    if (hh >= 8) {
      runEarningsCheck({ force: true, broadcast: wsBroadcast })
        .catch((err) => console.error('[earnings] startup check error:', err.message))
    }
  }, 5_000)

  console.log(
    `[alerts] Engine started — intraday every 30s (${ignoreRth ? 'no RTH gate' : 'RTH only'}), swing every 5min (weekdays)`,
  )
}
