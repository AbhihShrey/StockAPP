import { useEffect, useRef, useState } from 'react'
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
  const chgClass =
    chg == null || Number.isNaN(chg)
      ? 'text-zinc-500'
      : chgPositive
        ? 'text-[color:var(--color-success)]'
        : chg < 0
          ? 'text-rose-400'
          : 'text-zinc-400'

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
      setFlash(true)
      const id = window.setTimeout(() => setFlash(false), 700)
      return () => window.clearTimeout(id)
    }
  }, [priceNow])

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 p-4 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)] transition hover:bg-white/[0.035]">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-white/10 opacity-0 transition group-hover:opacity-100" />
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{asset.label}</p>
      <p
        className={[
          'mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-100',
          flash ? 'price-shimmer' : '',
        ].join(' ')}
      >
        {priceNum == null ? (
          formatValueStatic(asset)
        ) : (
          <AnimatedNumber value={priceNum} format={(n) => formatValueDisplay(asset, n)} duration={560} />
        )}
      </p>
      <p className={`mt-1 text-sm font-medium tabular-nums ${chgClass}`}>
        {chgNum == null ? formatChgStatic(chg) : <AnimatedNumber value={chgNum} format={formatChgDisplay} duration={560} />}
      </p>
      {asset.hint ? <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-zinc-600">{asset.hint}</p> : null}
    </div>
  )
}

export function GlobalAssetMarquee({ data, loading, error }) {
  const assets = Array.isArray(data?.assets) ? data.assets : []

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-sm text-rose-200">
        <p className="font-medium">Global assets</p>
        <p className="mt-1 text-rose-200/80">{error}</p>
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
