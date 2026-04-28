// Centralized display formatters for the Ember Finances UI.
import { getLocale } from './prefs'

export function fmtPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(n))
}

export function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const absStr = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v))
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${absStr}%`
}

export function fmtVol(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

/** Format a unix-seconds timestamp as 12-hour ET time ("10:30 AM ET"). */
export function fmtTime(unixSec) {
  if (!unixSec) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(Number(unixSec) * 1000))
}

/**
 * Format a "YYYY-MM-DD HH:MM" 24-h string as "YYYY-MM-DD H:MM AM/PM".
 * Treats the input as a naive datetime (no timezone conversion).
 */
export function fmtDateTime(raw) {
  if (!raw) return '—'
  const s = String(raw).replace('T', ' ')
  if (s.length < 16) return s.slice(0, 10)
  const [hhStr, mmStr] = s.slice(11, 16).split(':')
  const hh = Number(hhStr)
  const mm = Number(mmStr)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return s.slice(0, 16)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  return `${s.slice(0, 10)} ${h12}:${String(mm).padStart(2, '0')} ${period}`
}
