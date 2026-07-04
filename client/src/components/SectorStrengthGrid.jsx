import { useCallback, useRef } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { SectorGridSkeleton } from './DataSkeleton'

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRgb(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ]
}

/**
 * Down → warn → up heat scale for strength 0–100.
 * Data-driven chart colors are hex/rgb-in-JS by design-system exception.
 */
function strengthToAccentRgb(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return [131, 122, 111] // ink-3
  const s = Math.min(100, Math.max(0, score))
  const down = [255, 97, 97] // #d96c63
  const warn = [255, 194, 75] // #FFC24B
  const up = [61, 220, 151] // #48c78e
  if (s <= 50) {
    const t = s / 50
    return lerpRgb(down, warn, t)
  }
  const t = (s - 50) / 50
  return lerpRgb(warn, up, t)
}

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function DeltaValue({ value }) {
  const up = value != null && !Number.isNaN(value) && value > 0
  const down = value != null && !Number.isNaN(value) && value < 0
  return (
    <span className={['num inline-flex items-center gap-0.5 font-medium', up ? 'text-up' : down ? 'text-down' : 'text-ink-2'].join(' ')}>
      {up ? <span aria-hidden>▲</span> : down ? <span aria-hidden>▼</span> : null}
      {formatPct(value)}
    </span>
  )
}

function SectorCard({ row, onSelect }) {
  const score = row.strengthScore
  const [r, g, b] = strengthToAccentRgb(score)
  const tint = `rgb(${r} ${g} ${b})`
  const scoreNum = score != null && Number.isFinite(score) ? score : null
  const clickable = typeof onSelect === 'function'
  const rootRef = useRef(null)

  const onPointerMove = useCallback((e) => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--spot-x', `${x}%`)
    el.style.setProperty('--spot-y', `${y}%`)
  }, [])

  const onPointerLeave = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--spot-x', '50%')
    el.style.setProperty('--spot-y', '45%')
  }, [])

  return (
    <article
      ref={rootRef}
      className={[
        'panel panel-hover group relative flex flex-col overflow-hidden p-3 outline-none',
        clickable ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-ember/60' : '',
      ].join(' ')}
      style={{
        borderLeftColor: tint,
        borderLeftWidth: '3px',
        ['--spot-x']: '50%',
        ['--spot-y']: '45%',
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={clickable ? () => onSelect(row) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(row)
            }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[11px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(520px circle at var(--spot-x) var(--spot-y), rgba(255,107,44,0.07), transparent 52%)',
        }}
      />
      <div
        className="pointer-events-none absolute right-3 top-3 size-2.5 rounded-full opacity-70"
        style={{ background: tint }}
        aria-hidden
      />
      <p className="eyebrow relative">{row.name}</p>
      <p className="num relative text-sm font-semibold text-ink">{row.symbol}</p>
      <p className="display num relative mt-2 text-4xl" style={{ color: tint }}>
        {scoreNum == null ? '—' : <AnimatedNumber value={scoreNum} format={(n) => n.toFixed(1)} duration={540} />}
      </p>
      <p className="eyebrow relative mt-0.5">Strength</p>
      <dl className="relative mt-3.5 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px]">
        <div>
          <dt className="text-ink-3">1d</dt>
          <dd><DeltaValue value={row.changePercent1d} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">5d</dt>
          <dd><DeltaValue value={row.changePercent5d} /></dd>
        </div>
      </dl>
    </article>
  )
}

/** 4×3 layout (12 slots) for 11 SPDR sectors — one blank cell on large screens. */
export function SectorStrengthGrid({ data, loading, error, onSelect }) {
  const rows = Array.isArray(data?.rows) ? data.rows : []

  if (error) {
    return (
      <section className="panel border-down/25 bg-down/10 p-5 text-sm">
        <p className="font-medium text-ink">Sector strength failed to load</p>
        <p className="mt-1 text-down">{error}</p>
        <p className="mt-1 text-ink-3">It retries on the next refresh.</p>
      </section>
    )
  }

  if (loading && rows.length === 0) {
    return <SectorGridSkeleton />
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => (
          <SectorCard key={row.symbol} row={row} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
