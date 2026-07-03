import { useEffect, useRef, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatedNumber } from './AnimatedNumber'
import { GlobalAssetsSkeleton } from './DataSkeleton'

function formatValueDisplay(asset, n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (asset.unit === 'pct') return `${n.toFixed(2)}%`
  if (n >= 1000) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
}

function formatChgDisplay(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function formatValueStatic(asset) {
  const p = asset?.price
  return formatValueDisplay(asset, p)
}

function formatChgStatic(pct) {
  return formatChgDisplay(pct)
}

function AssetCard({ asset }) {
  const chg = asset?.changePercent
  const chgPositive = chg != null && chg > 0
  const chgNegative = chg != null && !Number.isNaN(chg) && chg < 0
  const chgClass =
    chg == null || Number.isNaN(chg) ? 'text-ink-3' : chgPositive ? 'text-up' : chgNegative ? 'text-down' : 'text-ink-2'

  const prev = useRef(null)
  const [flash, setFlash] = useState(false)
  const priceNow = asset?.price
  const priceNum = typeof priceNow === 'number' && Number.isFinite(priceNow) ? priceNow : null
  const chgNum = typeof chg === 'number' && Number.isFinite(chg) ? chg : null

  useEffect(() => {
    const p = prev.current
    prev.current = priceNow
    if (p === null || p === undefined) return
    if (priceNow === null || priceNow === undefined) return
    if (Number(p) !== Number(priceNow)) {
      // Price changed between polls — trigger a one-shot flash then clear it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlash(true)
      const id = window.setTimeout(() => setFlash(false), 700)
      return () => window.clearTimeout(id)
    }
  }, [priceNow])

  const DirIcon = chgPositive ? TrendingUp : chgNegative ? TrendingDown : null

  return (
    <div className="panel panel-hover group relative overflow-hidden p-4">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-ember/40 opacity-0 transition group-hover:opacity-100" />
      <p className="eyebrow">{asset.label}</p>
      <p className={['num mt-2 text-2xl font-semibold text-ink', flash ? 'ignite' : ''].join(' ')}>
        {priceNum == null ? (
          formatValueStatic(asset)
        ) : (
          <AnimatedNumber value={priceNum} format={(n) => formatValueDisplay(asset, n)} duration={560} />
        )}
      </p>
      <p className={`num mt-1 flex items-center gap-1 text-sm font-medium ${chgClass}`}>
        {DirIcon ? <DirIcon className="size-3.5" aria-hidden /> : null}
        {chgNum == null ? formatChgStatic(chg) : <AnimatedNumber value={chgNum} format={formatChgDisplay} duration={560} />}
      </p>
      {asset.hint ? <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-ink-3">{asset.hint}</p> : null}
    </div>
  )
}

export function GlobalAssetMarquee({ data, loading, error }) {
  const assets = Array.isArray(data?.assets) ? data.assets : []

  if (error) {
    return (
      <section className="panel panel-pad text-sm">
        <p className="font-medium text-ink">Global assets failed to load</p>
        <p className="mt-1 text-down">{error}</p>
      </section>
    )
  }

  if (loading && assets.length === 0) {
    return <GlobalAssetsSkeleton />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {assets.map((a) => (
        <AssetCard key={a.fmpSymbol ?? a.symbol} asset={a} />
      ))}
    </div>
  )
}
