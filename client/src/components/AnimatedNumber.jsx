import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ease with slight overshoot — reads as a soft spring */
function easeOutBack(t) {
  const c1 = 1.525
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/**
 * Smoothly tweens `value` when it changes (spring-ish easing).
 * `format` receives the in-progress number (or null).
 */
export function AnimatedNumber({ value, format, className = '', duration = 520 }) {
  const [display, setDisplay] = useState(value)
  const settledRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      settledRef.current = value
      setDisplay(value)
      return
    }
    if (!Number.isFinite(value)) {
      settledRef.current = value
      setDisplay(value)
      return
    }

    const from = settledRef.current
    if (from === null || from === undefined || Number.isNaN(from) || !Number.isFinite(from)) {
      settledRef.current = value
      setDisplay(value)
      return
    }

    if (prefersReducedMotion() || from === value || Math.abs(value - from) < 1e-12) {
      settledRef.current = value
      setDisplay(value)
      return
    }

    const t0 = performance.now()
    const dur = duration

    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur)
      const eased = easeOutBack(t)
      const next = from + (value - from) * eased
      setDisplay(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        settledRef.current = value
        setDisplay(value)
      }
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
