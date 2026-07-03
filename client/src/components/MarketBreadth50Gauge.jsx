import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { MarketBreadthSkeleton } from './DataSkeleton'

export function MarketBreadth50Gauge({ data, loading, error }) {
  const [fillIntro, setFillIntro] = useState(false)
  const didIntroRef = useRef(false)

  const pct = data?.pctAbove50sma
  const pctNum = pct != null && Number.isFinite(pct) ? pct : null

  useEffect(() => {
    if (pctNum == null) return
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
  }, [pctNum])

  if (loading && !data) return <MarketBreadthSkeleton />
  if (error) {
    return (
      <div className="text-sm">
        <p className="font-medium text-ink">Market breadth failed to load</p>
        <p className="mt-1 text-down">{error}</p>
        <p className="mt-1 text-ink-3">It retries on the next refresh.</p>
      </div>
    )
  }

  const widthPct = pctNum == null ? 0 : Math.min(100, Math.max(0, pctNum))
  const zone = pctNum == null ? 'neutral' : pctNum >= 60 ? 'strong' : pctNum <= 40 ? 'weak' : 'neutral'
  const barColor = zone === 'strong' ? 'bg-up' : zone === 'weak' ? 'bg-down' : 'bg-ink-3'

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={[
            'display num text-3xl',
            zone === 'strong' ? 'text-up' : zone === 'weak' ? 'text-down' : 'text-ink',
          ].join(' ')}
        >
          {pctNum == null ? '—' : <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={560} />}
        </p>
        <p className="text-sm font-medium text-ink-2">{zone === 'strong' ? 'Strong' : zone === 'weak' ? 'Weak' : 'Neutral'}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-3">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
            barColor,
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
