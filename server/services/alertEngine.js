import cron from 'node-cron'
import { sendAlertEmail } from './emailService.js'
import { fetchBatchQuotesBySymbols, fmpGet } from './fmp.js'
import { ORHL_CONDITIONS, getActiveAlerts, recordAlertFired } from './alertService.js'

let wsBroadcast = null

export function setWsBroadcast(fn) {
  wsBroadcast = fn
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

/** Set ALERTS_IGNORE_MARKET_HOURS=1 in server/.env to evaluate alerts outside RTH (testing / extended-hours quotes). */
function shouldRunAlertChecks() {
  if (String(process.env.ALERTS_IGNORE_MARKET_HOURS ?? '').trim() === '1') return true
  return isMarketHours()
}

function todayEtPrefix() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

// 55-second bar cache so VWAP + ORHL for the same symbol share one FMP call per minute
const barCache = new Map() // symbol -> { bars, fetchedAt }
const BAR_CACHE_TTL_MS = 55_000

async function fetchTodayBars(symbol) {
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
  // bars are oldest-first, all from today, times in ET
  if (bars.length === 0) return null

  // 9:30 ET in epoch
  const today = todayEtPrefix()
  const sessionStartMs = new Date(`${today}T09:30:00`).getTime() + new Date(`${today}T09:30:00`).getTimezoneOffset() * 60_000
  const etOffset = -new Date(`${today}T09:30:00`).getTimezoneOffset() // This is wrong, let's parse the bar times instead

  // Parse from bar date strings — they're in ET local time format "YYYY-MM-DD HH:MM:SS"
  const cutoffMinutes = 9 * 60 + 30 + openingMinutes

  const sessionBars = bars.filter((b) => {
    const [, timePart] = (b.date ?? '').split(' ')
    if (!timePart) return false
    const [hh, mm] = timePart.split(':').map(Number)
    const totalMins = hh * 60 + mm
    return totalMins >= 9 * 60 + 30 && totalMins < cutoffMinutes
  })

  if (sessionBars.length === 0) return null

  // Opening range period must have elapsed before firing
  const lastBarTime = sessionBars[sessionBars.length - 1]?.date ?? ''
  const [, lastTimePart] = lastBarTime.split(' ')
  const [lastHh, lastMm] = (lastTimePart ?? '00:00').split(':').map(Number)
  const lastMins = lastHh * 60 + lastMm
  if (lastMins < cutoffMinutes - 1) return null // period not yet complete

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

export async function runAlertCheck() {
  if (!shouldRunAlertChecks()) return

  const alerts = getActiveAlerts()
  if (alerts.length === 0) return

  const symbols = [...new Set(alerts.map((a) => a.symbol.toUpperCase()))]

  // Determine which symbols need 1-min bars
  const barSymbols = [...new Set(
    alerts
      .filter((a) => a.condition.startsWith('vwap') || ORHL_CONDITIONS.includes(a.condition))
      .map((a) => a.symbol.toUpperCase()),
  )]

  const [quoteMap] = await Promise.all([
    fetchBatchQuotesBySymbols(symbols),
    // Pre-warm bar cache in parallel
    ...barSymbols.map((sym) => fetchTodayBars(sym)),
  ])

  for (const alert of alerts) {
    const sym = alert.symbol.toUpperCase()
    const quote = quoteMap.get(sym)
    if (!quote?.price) continue

    const price = quote.price
    let fired = false
    let vwapAtTrigger = null

    if (alert.condition === 'vwap_above' || alert.condition === 'vwap_below') {
      const bars = await fetchTodayBars(sym) // hits cache
      if (bars.length < 3) continue
      const vwap = calcVwap(bars)
      if (vwap == null) continue
      vwapAtTrigger = vwap
      fired = alert.condition === 'vwap_above' ? price > vwap : price < vwap
    } else if (alert.condition === 'price_above') {
      fired = price > alert.threshold
    } else if (alert.condition === 'price_below') {
      fired = price < alert.threshold
    } else if (ORHL_CONDITIONS.includes(alert.condition)) {
      const bars = await fetchTodayBars(sym) // hits cache
      const orhl = calcOrhl(bars, Number(alert.threshold))
      if (!orhl) continue
      fired = alert.condition === 'orhl_above' ? price > orhl.high : price < orhl.low
    }

    if (!fired) continue

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
      }

      let wsDelivered = false
      if (wsBroadcast) {
        wsDelivered = wsBroadcast(alert.user_id, payload)
      }

      // Send email if WS not connected and user has email alerts on
      if (!wsDelivered && alert.email_alerts_enabled === 1 && alert.alert_email) {
        sendAlertEmail(alert.alert_email, {
          symbol: sym,
          condition: alert.condition,
          threshold: alert.threshold,
          triggeredPrice: price,
          vwapAtTrigger,
        }).catch(() => {})
      }

      console.log(`[alerts] ${sym} ${alert.condition} fired at $${price.toFixed(2)} (user ${alert.user_id})`)
    } catch (err) {
      console.error('[alerts] recordAlertFired error:', err.message)
    }
  }
}

export function startAlertEngine() {
  const ignoreRth = String(process.env.ALERTS_IGNORE_MARKET_HOURS ?? '').trim() === '1'
  if (ignoreRth) {
    console.warn('[alerts] ALERTS_IGNORE_MARKET_HOURS=1 — alert checks run 24/7 (for testing); use sparingly in production')
  }
  // Weekdays only by default so the engine stays idle Sat–Sun; testing flag enables weekend ticks too.
  const cronPattern = ignoreRth ? '* * * * *' : '* * * * 1-5'
  cron.schedule(cronPattern, () => {
    runAlertCheck().catch((err) => console.error('[alerts] engine error:', err.message))
  })
  console.log(
    `[alerts] Engine started — cron "${cronPattern}"; ${ignoreRth ? 'no RTH gate' : 'conditions evaluated only during US RTH (9:30–16:00 ET)'}`,
  )
}
