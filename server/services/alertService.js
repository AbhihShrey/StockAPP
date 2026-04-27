import db from '../db.js'

export const VALID_CONDITIONS = ['vwap_above', 'vwap_below', 'price_above', 'price_below', 'orhl_above', 'orhl_below', 'earnings_report']
export const ORHL_CONDITIONS = ['orhl_above', 'orhl_below']
export const ORHL_VALID_MINUTES = [1, 3, 5, 15, 30, 60]
export const SWING_CONDITIONS = ['price_above', 'price_below']
// Default cooldown for swing alerts: 24 hours (prevents re-fire on same day)
export const SWING_DEFAULT_COOLDOWN = 1440
const VALID_EARNINGS_SESSIONS = ['any', 'bmo', 'amc']

function normalizeAlertRow(r) {
  if (!r) return r
  return {
    ...r,
    alert_type: r.alert_type ?? 'intraday',
    cooldown_minutes: Number.isFinite(Number(r.cooldown_minutes)) ? Number(r.cooldown_minutes) : 60,
    min_volume_mult: r.min_volume_mult != null ? Number(r.min_volume_mult) : null,
    time_window_minutes: r.time_window_minutes != null ? Number(r.time_window_minutes) : null,
    buffer_pct: r.buffer_pct != null ? Number(r.buffer_pct) : null,
    earnings_date: r.earnings_date ?? null,
    earnings_session: r.earnings_session ?? null,
    earnings_eps_est: r.earnings_eps_est != null ? Number(r.earnings_eps_est) : null,
    earnings_prev_date: r.earnings_prev_date ?? null,
  }
}

export function conditionLabel(condition, threshold) {
  switch (condition) {
    case 'vwap_above': return 'Crosses above VWAP'
    case 'vwap_below': return 'Crosses below VWAP'
    case 'price_above': return `Above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `Below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `Crosses above OR High (${threshold}min)`
    case 'orhl_below': return `Crosses below OR Low (${threshold}min)`
    case 'earnings_report': return 'Earnings Report'
    default: return condition
  }
}

export function getActiveAlerts(alertType = 'intraday') {
  return db.prepare(`
    SELECT a.*, u.email, u.email_alerts_enabled, u.alert_email
    FROM alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.is_active = 1
      AND a.alert_type = ?
      AND (a.last_fired_at IS NULL OR (unixepoch() - a.last_fired_at) >= a.cooldown_minutes * 60)
  `).all(alertType)
}

export function getUserSettings(userId) {
  const row = db.prepare(
    'SELECT email_alerts_enabled, email_digest_enabled, alert_email FROM users WHERE id = ?',
  ).get(userId)
  if (!row) return null
  return {
    email_alerts_enabled: row.email_alerts_enabled === 1,
    email_digest_enabled: row.email_digest_enabled === 1,
    alert_email: row.alert_email ?? null,
  }
}

export function updateUserSettings(userId, { email_alerts_enabled, email_digest_enabled, alert_email }) {
  const updates = []
  const values = []
  if (email_alerts_enabled !== undefined) {
    updates.push('email_alerts_enabled = ?')
    values.push(email_alerts_enabled ? 1 : 0)
  }
  if (email_digest_enabled !== undefined) {
    updates.push('email_digest_enabled = ?')
    values.push(email_digest_enabled ? 1 : 0)
  }
  if (alert_email !== undefined) {
    const trimmed = typeof alert_email === 'string' ? alert_email.trim() : null
    updates.push('alert_email = ?')
    values.push(trimmed || null)
  }
  if (updates.length > 0) {
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, userId)
  }
  return getUserSettings(userId)
}

/** Returns all users who have opted in to the daily digest and have a delivery email. */
export function getUsersForDigest() {
  return db.prepare(`
    SELECT id, email, alert_email, email_digest_enabled
    FROM users
    WHERE email_digest_enabled = 1
  `).all().map((u) => ({ ...u, deliveryEmail: u.alert_email || u.email }))
}

/** Returns alerts fired in the last 24 hours for a user. */
export function getTodayAlertHistory(userId) {
  const since = Math.floor(Date.now() / 1000) - 86400
  return db.prepare(`
    SELECT * FROM alert_history
    WHERE user_id = ? AND triggered_at >= ?
    ORDER BY triggered_at DESC LIMIT 20
  `).all(userId, since)
}

export function getAlertsByUser(userId) {
  const rows = db.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  return rows.map(normalizeAlertRow)
}

export function getAlertHistoryByUser(userId, limit = 50) {
  return db.prepare(`
    SELECT * FROM alert_history WHERE user_id = ?
    ORDER BY triggered_at DESC LIMIT ?
  `).all(userId, limit)
}

export function createAlert(userId, { symbol, condition, threshold, cooldown_minutes, min_volume_mult, time_window_minutes, buffer_pct, alert_type, earnings_date, earnings_session, earnings_eps_est }) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym || sym.length > 12) return { ok: false, error: 'Invalid symbol.' }
  if (!VALID_CONDITIONS.includes(condition)) return { ok: false, error: 'Invalid condition.' }

  // Earnings alerts take a different path: no threshold, single one-shot fire on the day-of.
  if (condition === 'earnings_report') {
    const session = VALID_EARNINGS_SESSIONS.includes(earnings_session) ? earnings_session : 'any'
    const date = typeof earnings_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(earnings_date)
      ? earnings_date
      : null
    if (!date) return { ok: false, error: 'No upcoming earnings date found for this symbol within 90 days.' }

    const epsEst = earnings_eps_est != null && Number.isFinite(Number(earnings_eps_est))
      ? Number(earnings_eps_est)
      : null

    const count = db.prepare('SELECT COUNT(*) as n FROM alerts WHERE user_id = ? AND is_active = 1').get(userId).n
    if (count >= 30) return { ok: false, error: 'Active alert limit is 30.' }

    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO alerts (user_id, symbol, condition, threshold, cooldown_minutes, alert_type, earnings_date, earnings_session, earnings_eps_est)
      VALUES (?, ?, ?, NULL, 0, 'earnings', ?, ?, ?)
    `).run(userId, sym, 'earnings_report', date, session, epsEst)

    const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id)
    return { ok: true, alert: normalizeAlertRow(row) }
  }

  const alertTypeVal = alert_type === 'swing' ? 'swing' : 'intraday'

  if (alertTypeVal === 'swing' && !SWING_CONDITIONS.includes(condition)) {
    return { ok: false, error: 'Long-term alerts only support price above/below conditions.' }
  }

  const needsThreshold = condition === 'price_above' || condition === 'price_below'
  if (needsThreshold && (threshold == null || Number.isNaN(Number(threshold)))) {
    return { ok: false, error: 'A price threshold is required for this condition.' }
  }

  const isOrhl = ORHL_CONDITIONS.includes(condition)
  if (isOrhl) {
    const mins = Number(threshold)
    if (!ORHL_VALID_MINUTES.includes(mins)) {
      return { ok: false, error: `Opening range must be one of: ${ORHL_VALID_MINUTES.join(', ')} minutes.` }
    }
  }

  const defaultCooldown = alertTypeVal === 'swing' ? SWING_DEFAULT_COOLDOWN : 60
  const cooldown = Number.isFinite(Number(cooldown_minutes)) && Number(cooldown_minutes) >= 0
    ? Math.floor(Number(cooldown_minutes))
    : defaultCooldown

  // Volume mult: must be a number >= 1.0
  const volMult = min_volume_mult != null && Number.isFinite(Number(min_volume_mult)) && Number(min_volume_mult) >= 1.0
    ? Math.round(Number(min_volume_mult) * 10) / 10
    : null

  // Time window: positive integer minutes (15, 30, 60, 120)
  const timeWin = time_window_minutes != null && Number.isFinite(Number(time_window_minutes)) && Number(time_window_minutes) > 0
    ? Math.floor(Number(time_window_minutes))
    : null

  // Buffer: only valid for price_above / price_below, range 0.05–5%
  const buf = (condition === 'price_above' || condition === 'price_below') &&
    buffer_pct != null && Number.isFinite(Number(buffer_pct)) &&
    Number(buffer_pct) >= 0.05 && Number(buffer_pct) <= 5
    ? Math.round(Number(buffer_pct) * 100) / 100
    : null

  const count = db.prepare('SELECT COUNT(*) as n FROM alerts WHERE user_id = ? AND is_active = 1').get(userId).n
  if (count >= 30) return { ok: false, error: 'Active alert limit is 30.' }

  const thresholdVal = (needsThreshold || isOrhl) ? Number(threshold) : null

  const { lastInsertRowid: id } = db.prepare(`
    INSERT INTO alerts (user_id, symbol, condition, threshold, cooldown_minutes, min_volume_mult, time_window_minutes, buffer_pct, alert_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, sym, condition, thresholdVal, cooldown, volMult, timeWin, buf, alertTypeVal)

  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id)
  return { ok: true, alert: normalizeAlertRow(row) }
}

export function toggleAlert(userId, alertId, isActive) {
  const result = db.prepare('UPDATE alerts SET is_active = ? WHERE id = ? AND user_id = ?')
    .run(isActive ? 1 : 0, alertId, userId)
  if (result.changes === 0) return { ok: false, error: 'Alert not found.' }
  return { ok: true }
}

export function updateAlertCooldown(userId, alertId, cooldownMinutes) {
  const result = db.prepare('UPDATE alerts SET cooldown_minutes = ? WHERE id = ? AND user_id = ?')
    .run(cooldownMinutes, alertId, userId)
  if (result.changes === 0) return { ok: false, error: 'Alert not found.' }
  return { ok: true }
}

export function deleteAlert(userId, alertId) {
  const result = db.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(alertId, userId)
  if (result.changes === 0) return { ok: false, error: 'Alert not found.' }
  return { ok: true }
}

export function recordAlertFired(alertId, userId, { symbol, condition, threshold, triggeredPrice, vwapAtTrigger }) {
  db.prepare(`
    INSERT INTO alert_history (alert_id, user_id, symbol, condition, threshold, triggered_price, vwap_at_trigger)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(alertId, userId, symbol, condition, threshold ?? null, triggeredPrice ?? null, vwapAtTrigger ?? null)

  const alert = db.prepare('SELECT cooldown_minutes FROM alerts WHERE id = ?').get(alertId)
  if (!alert || alert.cooldown_minutes === 0) {
    db.prepare('UPDATE alerts SET is_active = 0, last_fired_at = unixepoch() WHERE id = ?').run(alertId)
  } else {
    db.prepare('UPDATE alerts SET last_fired_at = unixepoch() WHERE id = ?').run(alertId)
  }
}

/** Re-enable all triggered (is_active=0) alerts for a user, resetting last_fired_at. */
export function reactivateAllAlerts(userId) {
  const result = db.prepare(
    'UPDATE alerts SET is_active = 1, last_fired_at = NULL WHERE user_id = ? AND is_active = 0',
  ).run(userId)
  return { ok: true, count: result.changes }
}

/** Persist the current price-vs-reference position to survive server restarts. */
export function updateAlertPosition(alertId, position) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  db.prepare('UPDATE alerts SET last_position = ?, last_position_date = ? WHERE id = ?')
    .run(position, today, alertId)
}

/** Load all active alerts that have a persisted crossing state. Used at engine startup. */
export function loadActiveAlertPositions() {
  return db.prepare(`
    SELECT id, condition, last_position, last_position_date
    FROM alerts
    WHERE is_active = 1 AND last_position IS NOT NULL
  `).all()
}
