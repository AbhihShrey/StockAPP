import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Routes where chart canvases dominate frame budget — animation drops to a
// static stamp here so it never competes with chart rendering for paint time.
const CHART_HEAVY_ROUTES = new Set([
  '/markets',
  '/sectors',
  '/technical-analysis',
])

/** Returns 'full' | 'reduced' | 'static'.
 *  - 'static'  → user has prefers-reduced-motion: reduce. All animations off.
 *  - 'reduced' → on a chart-heavy route. Mascot still visible but no flicker;
 *                particles thinned; button bursts skipped.
 *  - 'full'    → everywhere else. */
export function useFireMotionEnabled() {
  const { pathname } = useLocation()
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (reduced) return 'static'
  if (CHART_HEAVY_ROUTES.has(pathname)) return 'reduced'
  return 'full'
}
