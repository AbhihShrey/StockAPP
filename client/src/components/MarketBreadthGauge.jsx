import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { MarketBreadthSkeleton } from './DataSkeleton'

export function MarketBreadthGauge({ data, loading, error }) {
  const [fillIntro, setFillIntro] = useState(false)
  const didIntroRef = useRef(false)

  useEffect(() => {
    const pct = data?.pctAbove200dma
    if (pct == null || Number.isNaN(pct)) return
    if (didIntroRef.current) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        didIntroRef.current = true
        setFillIntro(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [data])

  if (loading && !data) {
    return <MarketBreadthSkeleton />
  }
  if (error) {
    return (
      <div className="text-sm text-rose-200">
        <p className="font-medium">Market breadth</p>
        <p className="mt-1 text-rose-200/80">{error}</p>
      </div>
    )
  }

  const pct = data?.pctAbove200dma
  const label = data?.zoneLabel ?? '—'
  const zone = data?.zone ?? 'neutral'
  const history = Array.isArray(data?.history24h) ? data.history24h : []
  const z = data?.zScore24h

  const barColor =
    zone === 'strong'
      ? 'bg-[color:var(--color-success)]'
      : zone === 'weak'
        ? 'bg-rose-500'
        : 'bg-zinc-500'

  const glow =
    zone === 'strong'
      ? 'shadow-[0_0_18px_rgba(52,211,153,0.25)]'
      : zone === 'weak'
        ? 'shadow-[0_0_18px_rgba(248,113,113,0.22)]'
        : ''

  const widthPct = pct == null ? 0 : Math.min(100, Math.max(0, pct))
  const pctNum = pct != null && Number.isFinite(pct) ? pct : null

  void history

  const zState = (() => {
    if (z == null || !Number.isFinite(z)) return { label: 'Normal', tone: 'neutral' }
    if (z >= 1.5) return { label: 'Extreme +', tone: 'hot' }
    if (z <= -1.5) return { label: 'Extreme −', tone: 'cold' }
    return { label: 'Normal', tone: 'neutral' }
  })()

  const zToneClass =
    zState.tone === 'hot'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : zState.tone === 'cold'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
        : 'border-white/10 bg-white/5 text-zinc-200'

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={[
            'text-4xl font-semibold tabular-nums tracking-tight',
            zone === 'strong'
              ? 'text-[color:var(--color-success)]'
              : zone === 'weak'
                ? 'text-rose-300'
                : 'text-zinc-100',
          ].join(' ')}
        >
          {pctNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={580} />
          )}
        </p>
        <div className="flex flex-col items-end gap-1">
          <span className="text-right text-sm font-medium text-zinc-300">{label}</span>
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              zToneClass,
            ].join(' ')}
            title="Breadth z-score vs last 24h"
          >
            {zState.label}
            <span className="tabular-nums opacity-80">{z == null ? '' : `z=${z.toFixed(2)}`}</span>
          </span>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/5">
        <div
          className={[
            'metric-bar-fill-inner metric-bar-fill-spring h-full rounded-full',
            barColor,
            glow,
          ].join(' ')}
          style={{ width: fillIntro ? `${widthPct}%` : '0%' }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-zinc-600">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
