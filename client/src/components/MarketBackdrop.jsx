import { useEffect, useRef } from 'react'

/**
 * Ambient stock-chart backdrop. A fixed, low-opacity canvas that draws a couple of
 * drifting price series (random-walk lines with soft area fills) plus a faint grid.
 * The waveform drifts continuously and parallaxes with scroll, so it reads as a live
 * market ticker breathing behind the glass surfaces. Cheap: one canvas, ~2 paths.
 * Respects prefers-reduced-motion (renders a single static frame).
 */
export function MarketBackdrop() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let w = 0
    let h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // Deterministic pseudo-random walk (no Math.random at module scope needed here,
    // but instantaneous values are fine at runtime).
    const SERIES = [
      { color: '61,220,151', base: 0.62, amp: 0.16, speed: 0.55, pts: [] },   // up-green
      { color: '255,107,44', base: 0.44, amp: 0.2, speed: 0.4, pts: [] },     // ember
    ]
    const COUNT = 90
    for (const s of SERIES) {
      let v = s.base
      for (let i = 0; i < COUNT; i++) {
        v += (Math.random() - 0.5) * 0.05
        v = Math.max(0.12, Math.min(0.9, v))
        s.pts.push(v)
      }
    }

    let scrollY = window.scrollY || 0
    const onScroll = () => { scrollY = window.scrollY || 0 }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(244,232,216,0.035)'
      ctx.lineWidth = 1
      const step = 64
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }
    }

    const drawSeries = (s, phase, parallax) => {
      const n = s.pts.length
      const dx = w / (n - 2)
      const yFor = (i) => {
        const p = s.pts[i % n]
        return h - p * h * 0.9 - parallax
      }
      // Area fill
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let i = 0; i < n; i++) {
        const x = i * dx - (phase % dx)
        ctx.lineTo(x, yFor(i))
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, h * 0.3, 0, h)
      grad.addColorStop(0, `rgba(${s.color},0.10)`)
      grad.addColorStop(1, `rgba(${s.color},0)`)
      ctx.fillStyle = grad
      ctx.fill()
      // Line
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = i * dx - (phase % dx)
        const y = yFor(i)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(${s.color},0.5)`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    let raf = 0
    let t = 0
    const render = () => {
      ctx.clearRect(0, 0, w, h)
      drawGrid()
      const scrollNorm = scrollY
      SERIES.forEach((s, idx) => {
        const phase = t * s.speed + scrollNorm * 0.25
        const parallax = scrollNorm * (0.06 + idx * 0.05)
        drawSeries(s, phase, parallax)
      })
    }

    if (reduce) {
      render()
      return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', resize)
      }
    }

    const loop = () => {
      t += 0.6
      // append a fresh sample occasionally so the walk keeps evolving
      if (Math.floor(t) % 30 === 0) {
        for (const s of SERIES) {
          let v = s.pts[s.pts.length - 1] + (Math.random() - 0.5) * 0.05
          v = Math.max(0.12, Math.min(0.9, v))
          s.pts.push(v)
          s.pts.shift()
        }
      }
      render()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-60"
    />
  )
}
