import { MiniSparkline } from '../MiniSparkline'

function formatValue(asset) {
  const n = asset?.price
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (asset.unit === 'pct') return `${Number(n).toFixed(2)}%`
  if (asset.category === 'currency' && asset.symbol === 'UUP') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
  }
  if (n >= 1000) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
}

function formatChg(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${Number(pct).toFixed(2)}%`
}

export function MiniTerminalCard({ asset, staggerMs = 0 }) {
  const chg = asset?.changePercent
  const up = typeof chg === 'number' && Number.isFinite(chg) && chg > 0
  const down = typeof chg === 'number' && Number.isFinite(chg) && chg < 0
  const chgClass = up
    ? 'text-[color:var(--color-success)]'
    : down
      ? 'text-rose-300'
      : 'text-zinc-500'

  return (
    <div
      className={[
        'glass-bar dash-module-enter group flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-white/10 p-3',
        'shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)] transition will-change-transform',
        'hover:-translate-y-0.5 hover:bg-white/[0.035] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]',
      ].join(' ')}
      style={{ '--dash-stagger': `${staggerMs}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{asset.label}</p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-600">{asset.hint}</p>
        </div>
        {Array.isArray(asset.sparkline) && asset.sparkline.length > 1 ? (
          <MiniSparkline values={asset.sparkline} />
        ) : null}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums tracking-tight text-zinc-100">{formatValue(asset)}</p>
        <p className={`text-xs font-semibold tabular-nums ${chgClass}`}>{formatChg(chg)}</p>
      </div>
    </div>
  )
}
