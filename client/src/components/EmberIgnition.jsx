import { useEffect, useState } from 'react'

export function EmberIgnition() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onIgnite = () => {
      setActive(false)
      requestAnimationFrame(() => setActive(true))
      setTimeout(() => setActive(false), 900)
    }
    window.addEventListener('ember-theme-ignition', onIgnite)
    return () => window.removeEventListener('ember-theme-ignition', onIgnite)
  }, [])

  if (!active) return null
  return <div className="ember-ignition" aria-hidden="true" />
}
