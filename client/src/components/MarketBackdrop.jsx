import { useEffect, useRef } from 'react'

/**
 * Ember Terminal — cinematic institutional market backdrop.
 *
 * A single GPU-friendly canvas layering, back to front:
 *   1. Breathing ember-gold radial ambience + a slow drifting gradient mesh
 *   2. An ultra-faint Bloomberg-style financial grid that drifts for depth
 *   3. Diagonal ambient light rays (< 5% opacity)
 *   4. Flowing bezier price lines (right → left) with breakouts and corrections
 *   5. Candlestick clusters that fade in and out in random areas
 *   6. Thin analytics connector lines that draw between chart points
 *   7. Warm ember-gold dust particles with soft blur
 *
 * A heavy, refined mouse parallax (max ~10px) offsets each layer by depth.
 * Delta-timed for a steady 60fps, pauses when the tab is hidden, scales its
 * complexity down on mobile, and renders a single still frame when the user
 * prefers reduced motion.
 */

// Palette (rgb triplets) — exclusively the luxury ember-gold set.
const GOLD = '200,135,56'
const SECOND = '165,106,44'
const HL = '224,177,107'
const POS = '72,199,142'
const NEG = '217,108,99'
const PARCH = '232,222,210'
const GRIDC = '189,150,92'

export function MarketBackdrop() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.innerWidth < 768
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)

    let w = 0
    let h = 0

    // ---- Soft dust sprite (pre-rendered once; cheap blurred particles) ----
    const sprite = document.createElement('canvas')
    sprite.width = 64
    sprite.height = 64
    const sctx = sprite.getContext('2d')
    const sg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    sg.addColorStop(0, `rgba(${HL},0.9)`)
    sg.addColorStop(0.4, `rgba(${GOLD},0.4)`)
    sg.addColorStop(1, `rgba(${GOLD},0)`)
    sctx.fillStyle = sg
    sctx.fillRect(0, 0, 64, 64)

    // ---- Layer state ----
    const LINE_COUNT = mobile ? 3 : 4
    const PARTICLE_COUNT = mobile ? 12 : 30
    const RAY_COUNT = mobile ? 2 : 3
    const GRID_STEP = mobile ? 74 : 92

    const lines = []
    const particles = []
    const rays = []
    const candles = []
    const analytics = []

    const rand = (a, b) => a + Math.random() * (b - a)

    const buildLine = (idx) => {
      const band = 0.28 + (idx / LINE_COUNT) * 0.5 // vertical placement 0..1
      const palette = idx === 0 ? POS : idx === LINE_COUNT - 1 ? NEG : idx % 2 ? GOLD : HL
      const dx = mobile ? 60 : 74
      const n = Math.ceil((window.innerWidth + dx * 4) / dx) + 2
      const pts = []
      let v = band
      let trend = 0
      for (let i = 0; i < n; i++) {
        // occasional breakout / correction
        if (Math.random() < 0.06) trend = rand(-0.02, 0.02)
        trend *= 0.9
        v += trend + rand(-0.012, 0.012)
        v = Math.max(0.08, Math.min(0.92, v))
        pts.push(v)
      }
      return {
        pts,
        dx,
        band,
        trend,
        v,
        color: palette,
        alpha: rand(0.06, 0.14),
        speed: rand(0.18, 0.36) * (mobile ? 0.85 : 1), // px per frame-unit
        scroll: 0,
        width: idx === 0 || idx === LINE_COUNT - 1 ? 1.6 : 1.2,
        depth: 0.5 + idx * 0.16,
      }
    }

    const buildParticle = () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: rand(mobile ? 6 : 8, mobile ? 16 : 26),
      vx: rand(-0.12, 0.05),
      vy: rand(-0.06, 0.06),
      a: rand(0.05, 0.16),
      tw: rand(0, Math.PI * 2), // twinkle phase
      tws: rand(0.004, 0.012),
    })

    const buildRay = (i) => ({
      x: rand(-0.2, 0.9) * window.innerWidth,
      w: rand(140, 320),
      speed: rand(0.05, 0.12),
      a: rand(0.02, 0.045),
      depth: 0.35 + i * 0.1,
    })

    const seed = () => {
      lines.length = 0
      particles.length = 0
      rays.length = 0
      for (let i = 0; i < LINE_COUNT; i++) lines.push(buildLine(i))
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(buildParticle())
      for (let i = 0; i < RAY_COUNT; i++) rays.push(buildRay(i))
    }

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
    seed()

    // ---- Mouse parallax (heavy, eased) ----
    const PAR_MAX = 10
    let tpx = 0
    let tpy = 0
    let px = 0
    let py = 0
    const onMouse = (e) => {
      tpx = (e.clientX / w - 0.5) * 2 * PAR_MAX
      tpy = (e.clientY / h - 0.5) * 2 * PAR_MAX
    }
    if (!reduce && !mobile) window.addEventListener('mousemove', onMouse, { passive: true })

    // ---- Spawners ----
    let candleTimer = rand(120, 260)
    const spawnCandles = () => {
      const count = mobile ? 5 : Math.round(rand(6, 10))
      const cw = mobile ? 7 : 9
      const x = rand(0.1, 0.8) * w
      const y = rand(0.2, 0.75) * h
      const bars = []
      let base = rand(0.4, 0.6)
      for (let i = 0; i < count; i++) {
        const o = base
        base += rand(-0.12, 0.12)
        base = Math.max(0.1, Math.min(0.9, base))
        const c = base
        const hi = Math.max(o, c) + rand(0.02, 0.09)
        const lo = Math.min(o, c) - rand(0.02, 0.09)
        bars.push({ o, c, hi, lo, up: c >= o })
      }
      candles.push({ x, y, cw, bars, age: 0, ttl: rand(360, 560), span: mobile ? 46 : 62 })
    }

    let analyticsTimer = rand(160, 320)
    const spawnAnalytics = () => {
      const line = lines[Math.floor(Math.random() * lines.length)]
      const i1 = Math.floor(rand(0.1, 0.4) * line.pts.length)
      const i2 = Math.floor(rand(0.55, 0.9) * line.pts.length)
      analytics.push({ line, i1, i2, age: 0, draw: rand(70, 120), hold: rand(120, 200), fade: 90 })
    }

    // ---- Draw helpers ----
    const smoothPath = (line, parX) => {
      const { pts, dx, scroll } = line
      const xAt = (i) => i * dx - scroll + parX - dx * 2
      const yAt = (i) => h - pts[i] * h * 0.82 - h * 0.05
      ctx.beginPath()
      ctx.moveTo(xAt(0), yAt(0))
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (xAt(i) + xAt(i + 1)) / 2
        const yc = (yAt(i) + yAt(i + 1)) / 2
        ctx.quadraticCurveTo(xAt(i), yAt(i), xc, yc)
      }
    }

    const drawGrid = (t, ox, oy) => {
      const drift = (t * 0.006) % GRID_STEP
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(${GRIDC},0.035)`
      ctx.beginPath()
      for (let x = -GRID_STEP + (drift + ox) % GRID_STEP; x <= w; x += GRID_STEP) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h)
      }
      for (let y = -GRID_STEP + (oy) % GRID_STEP; y <= h; y += GRID_STEP) {
        ctx.moveTo(0, y); ctx.lineTo(w, y)
      }
      ctx.stroke()
    }

    const drawAmbient = (t, ox, oy) => {
      // Breathing radial (~18s) + a slow offset mesh lobe.
      const breathe = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / (18000 / 16.67))
      const cx1 = w * 0.5 + ox + Math.sin(t * 0.002) * w * 0.06
      const cy1 = h * 0.32 + oy
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.max(w, h) * 0.7)
      g1.addColorStop(0, `rgba(${GOLD},${0.05 + breathe * 0.05})`)
      g1.addColorStop(0.5, `rgba(${SECOND},${0.02 + breathe * 0.02})`)
      g1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, w, h)

      const cx2 = w * (0.7 + Math.sin(t * 0.0013) * 0.12)
      const cy2 = h * (0.75 + Math.cos(t * 0.0016) * 0.1)
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(w, h) * 0.55)
      g2.addColorStop(0, `rgba(${HL},0.03)`)
      g2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, w, h)
    }

    const drawRays = (t, ox, oy) => {
      ctx.save()
      ctx.translate(ox, oy)
      for (const r of rays) {
        r.x += r.speed
        if (r.x - r.w > w) r.x = -r.w * 2
        ctx.save()
        ctx.translate(r.x, -h * 0.2)
        ctx.rotate(0.32)
        const g = ctx.createLinearGradient(0, 0, r.w, 0)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(0.5, `rgba(${PARCH},${r.a})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, r.w, h * 1.6)
        ctx.restore()
      }
      ctx.restore()
    }

    const drawLine = (line, parX, parY) => {
      ctx.save()
      ctx.translate(0, parY)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      // glow pass
      smoothPath(line, parX)
      ctx.strokeStyle = `rgba(${line.color},${line.alpha * 0.4})`
      ctx.lineWidth = line.width * 5
      ctx.stroke()
      // crisp pass
      smoothPath(line, parX)
      ctx.strokeStyle = `rgba(${line.color},${line.alpha})`
      ctx.lineWidth = line.width
      ctx.stroke()
      ctx.restore()
    }

    const drawCandles = (c, ox, oy) => {
      const inRamp = Math.min(1, c.age / 90)
      const outRamp = Math.min(1, Math.max(0, (c.ttl - c.age) / 90))
      const k = Math.min(inRamp, outRamp)
      const alpha = 0.07 * k
      if (alpha <= 0.002) return
      ctx.save()
      ctx.translate(ox, oy)
      const step = c.span / c.bars.length
      c.bars.forEach((b, i) => {
        const x = c.x + i * step
        const col = b.up ? POS : NEG
        const yTop = c.y - b.hi * 40
        const yBot = c.y - b.lo * 40
        const yO = c.y - b.o * 40
        const yC = c.y - b.c * 40
        ctx.strokeStyle = `rgba(${col},${alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke()
        ctx.fillStyle = `rgba(${col},${alpha})`
        const top = Math.min(yO, yC)
        ctx.fillRect(x - c.cw / 2, top, c.cw, Math.max(1.5, Math.abs(yC - yO)))
      })
      ctx.restore()
    }

    const drawAnalytics = (a, parX, parY) => {
      const { line } = a
      const xAt = (i) => i * line.dx - line.scroll + parX - line.dx * 2
      const yAt = (i) => h - line.pts[i] * h * 0.82 - h * 0.05 + parY
      const x1 = xAt(a.i1); const y1 = yAt(a.i1)
      const x2 = xAt(a.i2); const y2 = yAt(a.i2)
      let prog = 1
      let alpha = 0.18
      if (a.age < a.draw) prog = a.age / a.draw
      else if (a.age > a.draw + a.hold) alpha = 0.18 * Math.max(0, 1 - (a.age - a.draw - a.hold) / a.fade)
      const ex = x1 + (x2 - x1) * prog
      const ey = y1 + (y2 - y1) * prog
      ctx.strokeStyle = `rgba(${HL},${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke()
      // nodes
      ctx.fillStyle = `rgba(${HL},${alpha * 1.4})`
      ctx.beginPath(); ctx.arc(x1, y1, 2, 0, Math.PI * 2); ctx.fill()
      if (prog >= 1) { ctx.beginPath(); ctx.arc(x2, y2, 2, 0, Math.PI * 2); ctx.fill() }
    }

    const drawParticles = (ox, oy) => {
      ctx.save()
      ctx.translate(ox, oy)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.tw += p.tws
        if (p.x < -40) p.x = w + 40
        if (p.x > w + 40) p.x = -40
        if (p.y < -40) p.y = h + 40
        if (p.y > h + 40) p.y = -40
        const a = p.a * (0.6 + 0.4 * Math.sin(p.tw))
        ctx.globalAlpha = a
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // ---- Frame ----
    const renderFrame = (t, dt) => {
      ctx.clearRect(0, 0, w, h)

      // eased parallax
      px += (tpx - px) * 0.04
      py += (tpy - py) * 0.04

      drawAmbient(t, px * 0.25, py * 0.25)
      drawGrid(t, px * 0.4, py * 0.4)
      drawRays(t, px * 0.5, py * 0.5)

      // price lines advance + recycle
      for (const line of lines) {
        line.scroll += line.speed * dt
        while (line.scroll >= line.dx) {
          line.scroll -= line.dx
          line.pts.shift()
          if (Math.random() < 0.06) line.trend = rand(-0.02, 0.02)
          line.trend *= 0.9
          line.v += line.trend + rand(-0.012, 0.012)
          line.v = Math.max(0.08, Math.min(0.92, line.v))
          line.pts.push(line.v)
        }
        drawLine(line, px * line.depth, py * line.depth)
      }

      // analytics connectors
      analyticsTimer -= dt
      if (analyticsTimer <= 0 && analytics.length < 3) {
        spawnAnalytics(); analyticsTimer = rand(160, 340)
      }
      for (let i = analytics.length - 1; i >= 0; i--) {
        const a = analytics[i]
        a.age += dt
        drawAnalytics(a, px * a.line.depth, py * a.line.depth)
        if (a.age > a.draw + a.hold + a.fade) analytics.splice(i, 1)
      }

      // candle clusters
      candleTimer -= dt
      if (candleTimer <= 0 && candles.length < (mobile ? 1 : 2)) {
        spawnCandles(); candleTimer = rand(200, 420)
      }
      for (let i = candles.length - 1; i >= 0; i--) {
        const c = candles[i]
        c.age += dt
        drawCandles(c, px * 0.8, py * 0.8)
        if (c.age > c.ttl) candles.splice(i, 1)
      }

      drawParticles(px * 1.2, py * 1.2)
    }

    // ---- Loop (delta-timed, tab-aware) ----
    let raf = 0
    let last = 0
    let running = true

    if (reduce) {
      // single composed still frame
      resize()
      renderFrame(0, 0)
      const onResize = () => { resize(); renderFrame(0, 0) }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    const loop = (now) => {
      if (!running) return
      if (!last) last = now
      let dt = (now - last) / 16.67
      last = now
      if (dt > 3) dt = 3 // clamp after stalls / tab resume
      renderFrame(now, dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        last = 0
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onResize = () => { resize(); seed() }
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  )
}
