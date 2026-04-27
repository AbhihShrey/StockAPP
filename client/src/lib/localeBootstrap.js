// Global number-locale shim. Many components were written with hard-coded
// 'en-US' or no locale at all; this rebinds Intl.NumberFormat /
// Number.prototype.toLocaleString so they honor the user's saved locale
// without per-file changes. Date/time formatting is left untouched so the
// "10:30 AM ET" market-session strings stay unchanged.

const LOCALE_KEY = 'stockline_number_locale'

function readLocale() {
  try {
    return localStorage.getItem(LOCALE_KEY) ?? 'en-US'
  } catch {
    return 'en-US'
  }
}

function shouldOverride(locales) {
  if (locales == null) return true
  if (typeof locales === 'string') return locales === 'en-US'
  if (Array.isArray(locales)) return locales.length === 0 || (locales.length === 1 && locales[0] === 'en-US')
  return false
}

function installNumberFormatShim() {
  const Original = Intl.NumberFormat
  function Patched(locales, options) {
    const effective = shouldOverride(locales) ? readLocale() : locales
    if (new.target) return Reflect.construct(Original, [effective, options], new.target)
    return Original(effective, options)
  }
  Patched.prototype = Original.prototype
  Patched.supportedLocalesOf = Original.supportedLocalesOf.bind(Original)
  Object.defineProperty(Patched, 'name', { value: 'NumberFormat' })
  Intl.NumberFormat = Patched
}

function installToLocaleStringShim() {
  const numToLocale = Number.prototype.toLocaleString
  Number.prototype.toLocaleString = function (locales, options) {
    const effective = shouldOverride(locales) ? readLocale() : locales
    return numToLocale.call(this, effective, options)
  }
}

let installed = false
export function installLocaleShim() {
  if (installed) return
  installed = true
  installNumberFormatShim()
  installToLocaleStringShim()
  document.documentElement.lang = readLocale()

  window.addEventListener('stockline-prefs-changed', (e) => {
    if (e.detail?.key !== 'locale') return
    document.documentElement.lang = readLocale()
    // Force a full re-render so already-formatted strings update everywhere.
    window.location.reload()
  })
}
