import { useEffect, useState } from 'react'

const THEME_KEY = 'stockline_theme'
const DENSITY_KEY = 'stockline_table_density'

export function getTheme() {
  return localStorage.getItem(THEME_KEY) ?? 'dark'
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
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function saveDensity(density) {
  localStorage.setItem(DENSITY_KEY, density)
  applyDensity(density)
}

/** React hook — returns 'light' | 'dark', updates when theme changes */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') ?? 'dark',
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') ?? 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

// Run at module load time so there's no flash of wrong theme
applyTheme(getTheme())
applyDensity(getDensity())
