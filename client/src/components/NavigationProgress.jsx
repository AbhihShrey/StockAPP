import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Thin top bar while route pathname changes. */
export function NavigationProgress() {
  const { pathname } = useLocation()
  const [phase, setPhase] = useState('idle')
  const skipFirst = useRef(true)

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    setPhase('enter')
    const t = window.setTimeout(() => setPhase('leave'), 400)
    return () => window.clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    if (phase === 'leave') {
      const t = window.setTimeout(() => setPhase('idle'), 320)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  if (phase === 'idle') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px] overflow-hidden" aria-hidden>
      <div
        className={[
          'nav-progress-bar accent-glow h-full bg-accent',
          phase === 'enter' ? 'nav-progress-bar--enter' : 'nav-progress-bar--leave',
        ].join(' ')}
      />
    </div>
  )
}
