import { useEffect, useRef, useState } from 'react'

/**
 * Slide up + fade in when scrolled into view.
 * @param {{ repeat?: boolean }} props — if `repeat`, animation runs again each time the block enters the viewport.
 */
export function RevealOnScroll({ children, className = '', delayMs = 0, repeat = false }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (repeat) {
          setVisible(e.isIntersecting)
        } else if (e.isIntersecting) {
          setVisible(true)
        }
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: [0, 0.06, 0.12] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [repeat])

  return (
    <div
      ref={ref}
      className={['reveal-on-scroll', visible ? 'reveal-on-scroll--visible' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={
        visible && delayMs > 0
          ? { transitionDelay: `${delayMs}ms` }
          : undefined
      }
    >
      {children}
    </div>
  )
}
