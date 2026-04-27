// User display preferences stored in localStorage.

const LOCALE_KEY = 'stockline_number_locale'
const CHART_STYLE_KEY = 'stockline_chart_style'
const QUIET_HOURS_KEY = 'stockline_quiet_hours'
const LANDING_KEY = 'stockline_default_landing'

export function getDefaultLanding() {
  return localStorage.getItem(LANDING_KEY) ?? '/dashboard'
}
export function saveDefaultLanding(path) {
  localStorage.setItem(LANDING_KEY, path)
  window.dispatchEvent(new CustomEvent('stockline-prefs-changed', { detail: { key: 'landing', value: path } }))
}

export function getLocale() {
  return localStorage.getItem(LOCALE_KEY) ?? 'en-US'
}
export function saveLocale(l) {
  localStorage.setItem(LOCALE_KEY, l)
  window.dispatchEvent(new CustomEvent('stockline-prefs-changed', { detail: { key: 'locale', value: l } }))
}

export function getChartStyle() {
  return localStorage.getItem(CHART_STYLE_KEY) ?? 'area'
}
export function saveChartStyle(s) {
  localStorage.setItem(CHART_STYLE_KEY, s)
  window.dispatchEvent(new CustomEvent('stockline-prefs-changed', { detail: { key: 'chartStyle', value: s } }))
}

const QUIET_DEFAULTS = { enabled: false, start: '22:00', end: '07:00' }

export function getQuietHours() {
  try {
    const raw = localStorage.getItem(QUIET_HOURS_KEY)
    return raw ? { ...QUIET_DEFAULTS, ...JSON.parse(raw) } : { ...QUIET_DEFAULTS }
  } catch {
    return { ...QUIET_DEFAULTS }
  }
}
export function saveQuietHours(prefs) {
  localStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(prefs))
}

/** Returns true if current ET time is inside the configured quiet window. */
export function isQuietHours() {
  const { enabled, start, end } = getQuietHours()
  if (!enabled) return false
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const nowMins = hh * 60 + mm
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  // Handle overnight ranges (e.g. 22:00 → 07:00)
  return startMins <= endMins
    ? nowMins >= startMins && nowMins < endMins
    : nowMins >= startMins || nowMins < endMins
}
