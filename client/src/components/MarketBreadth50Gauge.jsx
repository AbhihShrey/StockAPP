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
      <div className="text-sm text-rose-200">
        <p className="font-medium">Market breadth</p>
        <p className="mt-1 text-rose-200/80">{error}</p>
      </div>
    )
  }

  const widthPct = pctNum == null ? 0 : Math.min(100, Math.max(0, pctNum))
  const zone = pctNum == null ? 'neutral' : pctNum >= 60 ? 'strong' : pctNum <= 40 ? 'weak' : 'neutral'
  const barColor =
    zone === 'strong'
      ? 'bg-[color:var(--color-success)]'
      : zone === 'weak'
        ? 'bg-rose-500'
        : 'bg-zinc-500'

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={[
            'text-3xl font-semibold tabular-nums tracking-tight',
            zone === 'strong'
              ? 'text-[color:var(--color-success)]'
              : zone === 'weak'
                ? 'text-rose-300'
                : 'text-zinc-100',
          ].join(' ')}
        >
          {pctNum == null ? '—' : <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={560} />}
        </p>
        <p className="text-sm font-medium text-zinc-400">{zone === 'strong' ? 'Strong' : zone === 'weak' ? 'Weak' : 'Neutral'}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/5">
        <div
          className={['metric-bar-fill-inner metric-bar-fill-spring h-full rounded-full', barColor].join(' ')}
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

