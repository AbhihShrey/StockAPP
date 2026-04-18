import { useRef, useState } from 'react'

export function MagneticButton({ className = '', strength = 10, children, ...props }) {
  const ref = useRef(null)
  const [t, setT] = useState({ x: 0, y: 0 })

  function onMove(e) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = (e.clientX - cx) / (r.width / 2)
    const dy = (e.clientY - cy) / (r.height / 2)
    const clamp = (v) => Math.max(-1, Math.min(1, v))
    setT({ x: clamp(dx) * strength, y: clamp(dy) * strength })
  }

  function onLeave() {
    setT({ x: 0, y: 0 })
  }

  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
        transition: 'transform 140ms ease-out',
        willChange: 'transform',
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

