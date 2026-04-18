import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { MarketSentimentSkeleton } from './DataSkeleton'

function formatNum(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function scoreBarColor(score) {
  if (score == null || !Number.isFinite(score)) return 'bg-zinc-500'
  if (score <= 25) return 'bg-rose-500'
  if (score <= 45) return 'bg-orange-400'
  if (score <= 55) return 'bg-zinc-400'
  if (score <= 75) return 'bg-[color:var(--color-success)]'
  return 'bg-[color:var(--color-success)]'
}

export function MarketSentiment({ data, loading, error }) {
  const [fillIntro, setFillIntro] = useState(false)
  const didIntroRef = useRef(false)

  const score = data?.score
  const scoreNum = score != null && Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : null

  useEffect(() => {
    if (scoreNum == null) return
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
  }, [scoreNum])

  if (loading && !data) {
    return <MarketSentimentSkeleton />
  }
  if (error) {
    return (
      <div className="text-sm text-rose-200">
        <p className="font-medium">Market sentiment</p>
        <p className="mt-1 text-rose-200/80">{error}</p>
      </div>
    )
  }

  const label = data?.label ?? '—'
  const vix = data?.vix
  const pc = data?.putCallRatio

  let accent = 'text-zinc-200'
  if (score != null && Number.isFinite(score)) {
    if (score <= 25) accent = 'text-rose-300'
    else if (score <= 45) accent = 'text-orange-300'
    else if (score <= 55) accent = 'text-zinc-200'
    else if (score <= 75) accent = 'text-[color:var(--color-success)]'
    else accent = 'text-[color:var(--color-success)]'
  }

  const barW = scoreNum == null ? 0 : scoreNum

  return (
    <div>
      <div className="mt-2 flex flex-col items-center text-center">
        <p className={`text-6xl font-bold tabular-nums tracking-tight sm:text-7xl ${accent}`}>
          {scoreNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={scoreNum} format={(n) => formatNum(n, 1)} duration={600} />
          )}
        </p>
        <p className="mt-2 text-lg font-medium text-zinc-200">{label}</p>
      </div>
      <div className="mt-6 px-1">
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className={[
              'metric-bar-fill-inner metric-bar-fill-spring h-full rounded-full',
              scoreBarColor(scoreNum ?? score),
            ].join(' ')}
            style={{ width: fillIntro ? `${barW}%` : '0%' }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-600">
          <span>Fear</span>
          <span>Greed</span>
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-3 border-t border-border-subtle pt-5 text-sm">
        <div className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">VIX</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums tracking-tight text-zinc-200">{formatNum(vix, 2)}</dd>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Put / call</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums tracking-tight text-zinc-200">{formatNum(pc, 3)}</dd>
        </div>
      </dl>
    </div>
  )
}
