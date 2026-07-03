import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { MarketSentimentSkeleton } from './DataSkeleton'

function formatNum(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function scoreBarColor(score) {
  if (score == null || !Number.isFinite(score)) return 'bg-ink-3'
  if (score <= 25) return 'bg-down'
  if (score <= 45) return 'bg-warn'
  if (score <= 55) return 'bg-ink-3'
  return 'bg-up'
}

function scoreTextColor(score) {
  if (score == null || !Number.isFinite(score)) return 'text-ink'
  if (score <= 25) return 'text-down'
  if (score <= 45) return 'text-warn'
  if (score <= 55) return 'text-ink'
  return 'text-up'
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
      <div className="text-sm">
        <p className="font-medium text-ink">Market sentiment failed to load</p>
        <p className="mt-1 text-down">{error}</p>
        <p className="mt-1 text-ink-3">It retries on the next refresh.</p>
      </div>
    )
  }

  const label = data?.label ?? '—'
  const vix = data?.vix
  const pc = data?.putCallRatio

  const accent = scoreTextColor(score)
  const barW = scoreNum == null ? 0 : scoreNum

  return (
    <div>
      <div className="mt-2 flex flex-col items-center text-center">
        <p className={`display num text-6xl sm:text-7xl ${accent}`}>
          {scoreNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={scoreNum} format={(n) => formatNum(n, 1)} duration={600} />
          )}
        </p>
        <p className="mt-2 text-lg font-medium text-ink-2">{label}</p>
      </div>
      <div className="mt-6 px-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className={[
              'h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
              scoreBarColor(scoreNum ?? score),
            ].join(' ')}
            style={{ width: fillIntro ? `${barW}%` : '0%' }}
          />
        </div>
        <div className="eyebrow mt-2 flex justify-between">
          <span>Fear</span>
          <span>Greed</span>
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-5 text-sm">
        <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
          <dt className="eyebrow">VIX</dt>
          <dd className="num mt-1 text-sm font-medium text-ink">{formatNum(vix, 2)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
          <dt className="eyebrow">Put / call</dt>
          <dd className="num mt-1 text-sm font-medium text-ink">{formatNum(pc, 3)}</dd>
        </div>
      </dl>
    </div>
  )
}
