import { useEffect, useState } from 'react'

const THEME_KEY = 'ember_theme'
const DENSITY_KEY = 'ember_table_density'

export function getTheme() {
  return localStorage.getItem(THEME_KEY) ?? 'ember'
}

export function getDensity() {
  return localStorage.getItem(DENSITY_KEY) ?? 'default'
}

export function applyTheme(theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
}

export function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density)
}

export function saveTheme(theme) {
  const previous = localStorage.getItem(THEME_KEY)
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
  if (theme === 'ember' && previous !== 'ember' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ember-theme-ignition'))
  }
}

export function saveDensity(density) {
  localStorage.setItem(DENSITY_KEY, density)
  applyDensity(density)
}

/** React hook — returns the active theme value, updates when theme changes */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') ?? 'ember',
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') ?? 'ember')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

/** TradingView and Lightweight-charts only accept 'light' | 'dark'.
 *  Ember collapses to 'dark' so chart libs render correctly on the new theme. */
export function useChartTheme() {
  const theme = useTheme()
  return theme === 'light' ? 'light' : 'dark'
}

// Run at module load time so there's no flash of wrong theme
applyTheme(getTheme())
applyDensity(getDensity())
