import { useCallback } from 'react'
import { useFireMotionEnabled } from './useFireMotionEnabled'

const SPARK_COUNT = 9
const BURST_LIFETIME_MS = 850

let portalRoot = null

function getPortalRoot() {
  if (typeof document === 'undefined') return null
  if (portalRoot && document.body.contains(portalRoot)) return portalRoot
  portalRoot = document.createElement('div')
  portalRoot.className = 'ember-burst-portal'
  portalRoot.setAttribute('aria-hidden', 'true')
  document.body.appendChild(portalRoot)
  return portalRoot
}

export function useEmberBurst() {
  const motion = useFireMotionEnabled()

  return useCallback(
    (event) => {
      if (motion !== 'full') return
      const root = getPortalRoot()
      if (!root) return

      let x = 0
      let y = 0
      if (event && typeof event.clientX === 'number') {
        x = event.clientX
        y = event.clientY
      } else if (event && event.currentTarget && event.currentTarget.getBoundingClientRect) {
        const rect = event.currentTarget.getBoundingClientRect()
        x = rect.left + rect.width / 2
        y = rect.top + rect.height / 2
      } else {
        return
      }

      const burst = document.createElement('div')
      burst.className = 'ember-burst'
      burst.style.left = `${x}px`
      burst.style.top = `${y}px`

      for (let i = 0; i < SPARK_COUNT; i += 1) {
        const spark = document.createElement('span')
        spark.className = 'ember-burst-spark'
        const angle = (Math.PI * 2 * i) / SPARK_COUNT + Math.random() * 0.3
        const distance = 24 + Math.random() * 31
        spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
        spark.style.setProperty('--dy', `${Math.sin(angle) * distance - 8}px`)
        spark.style.setProperty('--delay', `${Math.random() * 80}ms`)
        burst.appendChild(spark)
      }

      root.appendChild(burst)
      setTimeout(() => {
        if (burst.parentNode) burst.parentNode.removeChild(burst)
      }, BURST_LIFETIME_MS)
    },
    [motion],
  )
}
