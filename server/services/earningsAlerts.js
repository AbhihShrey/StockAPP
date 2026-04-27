import db from '../db.js'
import { fmpGet } from './fmp.js'
import { recordAlertFired } from './alertService.js'

/**
 * Earnings-report alerts.
 *
 *   /earnings?symbol={SYM}        → list of earnings rows (date, epsEstimated, time, …)
 *
 * Each earnings alert stores the next-known earnings date, the auto-detected
 * session ('bmo' | 'amc' | 'any', from FMP's `time` field — used only to pick
 * notification wording), and consensus EPS estimate. The engine fires once at
 * 8:00 AM ET on the day-of (or on first server boot after 8 AM that day).
 */

export const EARNINGS_CONDITION = 'earnings_report'
export const EARNINGS_ALERT_TYPE = 'earnings'
export const VALID_EARNINGS_SESSIONS = ['any', 'bmo', 'amc']
const LOOKAHEAD_DAYS = 90

function todayEt() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

function etMinutesNow() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hh * 60 + mm
}

function isWeekdayEt() {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    .format(new Date())
  return wd !== 'Sat' && wd !== 'Sun'
}

function toNumber(v) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function deriveSession(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'bmo') return 'bmo'
  if (v === 'amc') return 'amc'
  return 'any'
}

/**
 * Pick the earliest future earnings row within the lookahead window.
 * Returns { date, epsEstimated, session } or null when nothing matches.
 */
export async function fetchNextEarnings(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return null

  const today = todayEt()
  const cutoff = addDaysIso(today, LOOKAHEAD_DAYS)

  let rows = []
  try {
    const data = await fmpGet('/earnings', { symbol: sym })
    rows = Array.isArray(data) ? data : []
  } catch {
    return null
  }

  const future = rows
    .filter((r) => typeof r?.date === 'string' && r.date >= today && r.date <= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (future.length === 0) return null

  const next = future[0]
  return {
    date: next.date,
    epsEstimated: toNumber(next.epsEstimated),
    session: deriveSession(next.time),
  }
}

function notificationBody(symbol, session, epsEst) {
  const when = session === 'bmo'
    ? 'this morning'
    : session === 'amc'
      ? 'after the close'
      : 'today'
  const epsTxt = epsEst != null && Number.isFinite(epsEst)
    ? ` — EPS est. $${Number(epsEst).toFixed(2)}`
    : ''
  return `${symbol} reports earnings ${when}${epsTxt}`
}

/**
 * For each active earnings alert: if the stored date matches today (ET) and
 * the session preference allows firing now, record-and-broadcast a fire.
 *
 * The cron at 8:00 AM ET fires alerts for the day. A startup invocation also
 * runs once if the server boots after 8 AM, ensuring users who open the app
 * mid-morning still see the notification.
 *
 * `force=true` ignores the time-of-day gate (used by cron at 8 AM and tests).
 */
export async function runEarningsCheck({ force = false, broadcast = null } = {}) {
  if (!force) {
    if (!isWeekdayEt()) return { fired: 0 }
    if (etMinutesNow() < 8 * 60) return { fired: 0 }
  }

  const today = todayEt()
  const rows = db.prepare(`
    SELECT a.*, u.email, u.email_alerts_enabled, u.alert_email
    FROM alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.is_active = 1
      AND a.alert_type = ?
      AND a.earnings_date = ?
      AND (a.last_fired_at IS NULL OR date(a.last_fired_at, 'unixepoch') <> ?)
  `).all(EARNINGS_ALERT_TYPE, today, today)

  let fired = 0
  for (const alert of rows) {
    const session = alert.earnings_session ?? 'any'
    if (session === 'bmo' && etMinutesNow() >= 16 * 60) continue
    if (session === 'amc' && etMinutesNow() < 16 * 60 && !force) {
      // For AMC alerts we still fire at 8 AM (per spec — single notification
      // at 8:00 AM ET on the day of), so don't skip when forcing or in normal flow.
      // Only skip when running outside business hours unforced; covered above.
    }

    try {
      recordAlertFired(alert.id, alert.user_id, {
        symbol: alert.symbol,
        condition: EARNINGS_CONDITION,
        threshold: null,
        triggeredPrice: null,
        vwapAtTrigger: null,
      })
    } catch (err) {
      console.error('[earnings] recordAlertFired error:', err.message)
      continue
    }

    fired++

    if (typeof broadcast === 'function') {
      try {
        broadcast(alert.user_id, {
          type: 'alert_fired',
          alertId: alert.id,
          symbol: alert.symbol,
          condition: EARNINGS_CONDITION,
          threshold: null,
          triggeredPrice: null,
          vwapAtTrigger: null,
          triggeredAt: Math.floor(Date.now() / 1000),
          alertType: EARNINGS_ALERT_TYPE,
          earningsSession: session,
          earningsEpsEst: alert.earnings_eps_est ?? null,
          message: notificationBody(alert.symbol, session, alert.earnings_eps_est),
        })
      } catch {}
    }
  }

  if (fired > 0) console.log(`[earnings] Fired ${fired} earnings alert(s) for ${today}`)
  return { fired }
}

/**
 * Refresh stored earnings dates daily — companies sometimes reschedule. When
 * the date changes, stash the previous one in `earnings_prev_date` so the UI
 * can surface a "Date updated to {new date}" badge.
 */
export async function refreshEarningsDates() {
  const rows = db.prepare(`
    SELECT id, symbol, earnings_date, earnings_session
    FROM alerts
    WHERE is_active = 1 AND alert_type = ?
  `).all(EARNINGS_ALERT_TYPE)

  let updated = 0
  for (const alert of rows) {
    try {
      const next = await fetchNextEarnings(alert.symbol)
      if (!next || !next.date) continue
      if (next.date === alert.earnings_date) {
        // Date unchanged — refresh EPS estimate and session in case FMP filled them in.
        db.prepare('UPDATE alerts SET earnings_eps_est = ?, earnings_session = ? WHERE id = ?')
          .run(next.epsEstimated, next.session, alert.id)
        continue
      }
      db.prepare(`
        UPDATE alerts
        SET earnings_prev_date = COALESCE(earnings_prev_date, ?),
            earnings_date = ?,
            earnings_eps_est = ?,
            earnings_session = ?
        WHERE id = ?
      `).run(alert.earnings_date, next.date, next.epsEstimated, next.session, alert.id)
      updated++
    } catch (err) {
      console.error(`[earnings] refresh failed for ${alert.symbol}:`, err.message)
    }
  }

  if (updated > 0) console.log(`[earnings] Refreshed ${updated} rescheduled earnings date(s)`)
  return { updated }
}

/** Clear the "date updated" marker (called when the user dismisses the badge). */
export function dismissEarningsDateBadge(userId, alertId) {
  const result = db.prepare(`
    UPDATE alerts SET earnings_prev_date = NULL
    WHERE id = ? AND user_id = ? AND alert_type = ?
  `).run(alertId, userId, EARNINGS_ALERT_TYPE)
  return { ok: result.changes > 0 }
}

export function buildEarningsNotificationBody(symbol, session, epsEst) {
  return notificationBody(symbol, session, epsEst)
}
