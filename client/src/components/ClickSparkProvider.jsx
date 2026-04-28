import { useEffect, useState } from 'react'
import { useFireMotionEnabled } from '../lib/useFireMotionEnabled'

const SPARK_KEY = 'ember_click_sparks'
const SPARK_COUNT = 4
const LIFETIME_MS = 500

let portalRoot = null

function getPortal() {
  if (typeof document === 'undefined') return null
  if (portalRoot && document.body.contains(portalRoot)) return portalRoot
  portalRoot = document.createElement('div')
  portalRoot.className = 'ember-click-portal'
  portalRoot.setAttribute('aria-hidden', 'true')
  document.body.appendChild(portalRoot)
  return portalRoot
}

function spawnSpark(x, y) {
  const root = getPortal()
  if (!root) return
  const burst = document.createElement('div')
  burst.className = 'ember-click-burst'
  burst.style.left = `${x}px`
  burst.style.top = `${y}px`
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const span = document.createElement('span')
    span.className = 'ember-click-spark'
    const angle = (Math.PI * 2 * i) / SPARK_COUNT + Math.random() * 0.6
    const dist = 8 + Math.random() * 14
    span.style.setProperty('--cx', `${Math.cos(angle) * dist}px`)
    span.style.setProperty('--cy', `${Math.sin(angle) * dist - 4}px`)
    burst.appendChild(span)
  }
  root.appendChild(burst)
  setTimeout(() => {
    if (burst.parentNode) burst.parentNode.removeChild(burst)
  }, LIFETIME_MS)
}

export function ClickSparkProvider() {
  const motion = useFireMotionEnabled()
  const [enabled, setEnabled] = useState(() =>
    typeof window === 'undefined' ? true : localStorage.getItem(SPARK_KEY) !== 'false',
  )

  useEffect(() => {
    const onPrefs = () => setEnabled(localStorage.getItem(SPARK_KEY) !== 'false')
    window.addEventListener('ember-prefs-changed', onPrefs)
    return () => window.removeEventListener('ember-prefs-changed', onPrefs)
  }, [])

  useEffect(() => {
    if (!enabled || motion !== 'full') return
    const onClick = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-no-click-spark]')) return
      spawnSpark(e.clientX, e.clientY)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [enabled, motion])

  return null
}
