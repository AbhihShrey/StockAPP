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

/** Deep red → amber → bright emerald for strength 0–100 */
function strengthToAccentRgb(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return [63, 63, 70]
  const s = Math.min(100, Math.max(0, score))
  const deepRed = [127, 29, 29]
  const amber = [245, 158, 11]
  const emerald = [52, 211, 153]
  if (s <= 50) {
    const t = s / 50
    return lerpRgb(deepRed, amber, t)
  }
  const t = (s - 50) / 50
  return lerpRgb(amber, emerald, t)
}

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
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
        'group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 p-3 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)] transition will-change-transform hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035]',
        clickable ? 'cursor-pointer' : '',
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
            'radial-gradient(520px circle at var(--spot-x) var(--spot-y), rgba(255,255,255,0.11), transparent 52%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-px rounded-[10px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      />
      <div className="pointer-events-none absolute right-3 top-3 size-2.5 rounded-full opacity-70" style={{ background: tint }} />
      <p className="relative text-[11px] font-medium uppercase tracking-wide text-zinc-400">{row.name}</p>
      <p className="relative text-sm font-semibold tracking-tight text-zinc-200">{row.symbol}</p>
      <p className="relative mt-2 text-4xl font-bold tabular-nums tracking-tight" style={{ color: tint }}>
        {scoreNum == null ? '—' : <AnimatedNumber value={scoreNum} format={(n) => n.toFixed(1)} duration={540} />}
      </p>
      <p className="relative mt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Strength</p>
      <dl className="relative mt-3.5 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
        <div>
          <dt className="text-zinc-600">1d</dt>
          <dd className="tabular-nums font-medium tracking-tight text-zinc-300">{formatPct(row.changePercent1d)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">5d</dt>
          <dd className="tabular-nums font-medium tracking-tight text-zinc-300">{formatPct(row.changePercent5d)}</dd>
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
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-sm text-rose-200">
        <p className="font-medium">Sector strength</p>
        <p className="mt-1 text-rose-200/80">{error}</p>
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
