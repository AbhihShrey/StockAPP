import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAlerts } from '../context/AlertContext'
import { isQuietHours } from '../lib/prefs'
import { useFireMotionEnabled } from '../lib/useFireMotionEnabled'
import { playFireCrackle } from '../lib/sounds'

const MASCOT_KEY = 'ember_mascot_enabled'
const GREETED_KEY = 'ember_mascot_greeted'

const BORED_MIN_MS = 15_000
const BORED_MAX_MS = 28_000
const QUIET_POLL_MS = 60_000

function nextBoredDelay() {
  return BORED_MIN_MS + Math.random() * (BORED_MAX_MS - BORED_MIN_MS)
}

function radialPuffs(count = 8) {
  const ids = []
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count
    ids.push({
      id: Date.now() + i,
      x: Math.cos(angle) * 26,
      y: Math.sin(angle) * 26 - 6,
    })
  }
  return ids
}

export function FireSpirit({ onActivate }) {
  const motion = useFireMotionEnabled()
  const [enabled, setEnabled] = useState(() =>
    typeof window === 'undefined' ? true : localStorage.getItem(MASCOT_KEY) !== 'false',
  )

  useEffect(() => {
    const onPrefs = () => setEnabled(localStorage.getItem(MASCOT_KEY) !== 'false')
    window.addEventListener('ember-prefs-changed', onPrefs)
    return () => window.removeEventListener('ember-prefs-changed', onPrefs)
  }, [])

  const { notifications } = useAlerts()
  const { pathname } = useLocation()

  const [state, setState] = useState('idle')
  const [hovered, setHovered] = useState(false)
  const [puffs, setPuffs] = useState([])
  const [asleep, setAsleep] = useState(() => isQuietHours())

  const lastNotifLen = useRef(notifications.length)
  const lastPath = useRef(pathname)
  const boredTimer = useRef(null)
  const stateResetTimer = useRef(null)

  useEffect(() => {
    setAsleep(isQuietHours())
    const i = setInterval(() => setAsleep(isQuietHours()), QUIET_POLL_MS)
    return () => clearInterval(i)
  }, [])

  // First-mount welcome wiggle (once per session).
  useEffect(() => {
    if (!enabled || motion === 'static' || asleep) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(GREETED_KEY) === '1') return
    sessionStorage.setItem(GREETED_KEY, '1')
    const t = setTimeout(() => {
      setState('greet')
      setPuffs([
        { id: Date.now(), x: -14, y: -8 },
        { id: Date.now() + 1, x: 14, y: -8 },
      ])
      setTimeout(() => setPuffs([]), 1200)
      setTimeout(() => setState('idle'), 800)
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (motion === 'static' || asleep || !enabled) return
    if (boredTimer.current) clearTimeout(boredTimer.current)
    boredTimer.current = setTimeout(() => {
      setState('bored')
      const base = Date.now()
      setPuffs([
        { id: base,     x: -14, y: -4 },
        { id: base + 1, x: 0,   y: -8 },
        { id: base + 2, x: 14,  y: -4 },
      ])
      setTimeout(() => setPuffs([]), 1400)
      setTimeout(() => setState('idle'), 900)
    }, nextBoredDelay())
    return () => {
      if (boredTimer.current) clearTimeout(boredTimer.current)
    }
  }, [state, motion, asleep, enabled])

  useEffect(() => {
    if (notifications.length > lastNotifLen.current) {
      if (motion !== 'static' && !asleep && enabled) {
        setState('alert')
        if (stateResetTimer.current) clearTimeout(stateResetTimer.current)
        stateResetTimer.current = setTimeout(() => setState('idle'), 850)
      }
    }
    lastNotifLen.current = notifications.length
  }, [notifications.length, motion, asleep, enabled])

  useEffect(() => {
    if (pathname !== lastPath.current) {
      if (motion === 'full' && !asleep && enabled) {
        setState('pageChange')
        if (stateResetTimer.current) clearTimeout(stateResetTimer.current)
        stateResetTimer.current = setTimeout(() => setState('idle'), 350)
      }
      lastPath.current = pathname
    }
  }, [pathname, motion, asleep, enabled])

  const onClick = () => {
    if (!enabled || motion === 'static' || asleep) {
      onActivate?.()
      return
    }
    setState('happy')
    setPuffs(radialPuffs(8))
    playFireCrackle()
    setTimeout(() => setPuffs([]), 1200)
    setTimeout(() => setState('idle'), 700)
    onActivate?.()
  }

  if (!enabled) return null

  const wrapperClass = [
    'ember-spirit',
    asleep ? 'ember-spirit-asleep' : `ember-spirit-${state}`,
    motion === 'static' ? 'ember-spirit-static' : '',
    motion === 'reduced' ? 'ember-spirit-reduced' : '',
    hovered ? 'ember-spirit-hovered' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={wrapperClass}
      role="button"
      tabIndex={0}
      aria-label="Ember mascot"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" className="ember-spirit-svg">
        <path
          className="ember-spirit-body ember-spirit-body-outer"
          d="M 24 6 C 30 13, 36 19, 36 28 C 36 36, 30 41, 24 41 C 18 41, 12 36, 12 28 C 12 22, 18 17, 22 9 Z"
          fill="var(--color-ember-outer, #c2421e)"
        />
        <path
          className="ember-spirit-body-mid"
          d="M 24 13 C 29 19, 33 23, 33 29 C 33 35, 29 39, 24 39 C 19 39, 15 35, 15 29 C 15 24, 19 20, 22 14 Z"
          fill="var(--color-ember-mid, #ff8a3d)"
        />
        <path
          className="ember-spirit-core"
          d="M 24 22 C 27 25, 29 29, 27 33 C 26 36, 22 36, 21 33 C 19 29, 21 25, 24 22 Z"
          fill="var(--color-ember-hot, #ffe0a8)"
          opacity="0.85"
        />
        <circle className="ember-spirit-eye ember-spirit-eye-l" cx="20" cy="27" r="1.4" fill="oklch(0.20 0.05 30)"/>
        <circle className="ember-spirit-eye ember-spirit-eye-r" cx="28" cy="27" r="1.4" fill="oklch(0.20 0.05 30)"/>
      </svg>

      {puffs.map((p) => (
        <span
          key={p.id}
          className="ember-spirit-puff"
          style={{ '--puff-x': `${p.x}px`, '--puff-y': `${p.y ?? -32}px` }}
        />
      ))}
    </div>
  )
}
