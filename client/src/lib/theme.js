import { useState } from 'react'

const THEME_KEY = 'ember_theme'
const DENSITY_KEY = 'ember_table_density'

/* v2 "Ember Terminal" is a single dark theme. The theme API is kept so existing
   call sites (Settings, charts) don't break, but every value resolves to 'ember'. */

export function getTheme() {
  return 'ember'
}

export function getDensity() {
  return localStorage.getItem(DENSITY_KEY) ?? 'default'
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', 'ember')
}

export function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density)
}

export function saveTheme() {
  localStorage.setItem(THEME_KEY, 'ember')
  applyTheme()
}

export function saveDensity(density) {
  localStorage.setItem(DENSITY_KEY, density)
  applyDensity(density)
}

/** Always the single dark terminal theme. */
export function useTheme() {
  const [theme] = useState('ember')
  return theme
}

/** TradingView and lightweight-charts only accept 'light' | 'dark'. */
export function useChartTheme() {
  return 'dark'
}

// Run at module load time so there's no flash of wrong theme
applyTheme()
applyDensity(getDensity())
