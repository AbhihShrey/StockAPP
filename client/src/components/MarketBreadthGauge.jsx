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
      <div className="text-sm">
        <p className="font-medium text-ink">Market breadth failed to load</p>
        <p className="mt-1 text-down">{error}</p>
        <p className="mt-1 text-ink-3">It retries on the next refresh.</p>
      </div>
    )
  }

  const pct = data?.pctAbove200dma
  const label = data?.zoneLabel ?? '—'
  const zone = data?.zone ?? 'neutral'
  const history = Array.isArray(data?.history24h) ? data.history24h : []
  const z = data?.zScore24h

  const barColor = zone === 'strong' ? 'bg-up' : zone === 'weak' ? 'bg-down' : 'bg-ink-3'

  const glow =
    zone === 'strong'
      ? 'shadow-[0_0_18px_rgba(61,220,151,0.25)]'
      : zone === 'weak'
        ? 'shadow-[0_0_18px_rgba(255,97,97,0.22)]'
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

  const zChipClass = zState.tone === 'hot' ? 'chip chip-warn' : zState.tone === 'cold' ? 'chip chip-down' : 'chip'

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={[
            'display num text-4xl',
            zone === 'strong' ? 'text-up' : zone === 'weak' ? 'text-down' : 'text-ink',
          ].join(' ')}
        >
          {pctNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={580} />
          )}
        </p>
        <div className="flex flex-col items-end gap-1">
          <span className="text-right text-sm font-medium text-ink-2">{label}</span>
          <span className={zChipClass} title="Breadth z-score vs last 24h">
            {zState.label}
            <span className="num opacity-80">{z == null ? '' : `z=${z.toFixed(2)}`}</span>
          </span>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-3">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
            barColor,
            glow,
          ].join(' ')}
          style={{ width: fillIntro ? `${widthPct}%` : '0%' }}
        />
      </div>
      <div className="num flex justify-between text-[11px] text-ink-3">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
