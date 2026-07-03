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
  const chgClass = up ? 'text-up' : down ? 'text-down' : 'text-ink-3'

  return (
    <div
      className="panel panel-hover rise flex min-h-[5.5rem] flex-col justify-between bg-surface-2 p-3"
      style={{ animationDelay: `${staggerMs}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">
            {asset.label}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-ink-3">{asset.hint}</p>
        </div>
        {Array.isArray(asset.sparkline) && asset.sparkline.length > 1 ? (
          <MiniSparkline values={asset.sparkline} />
        ) : null}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="num text-lg font-semibold text-ink">{formatValue(asset)}</p>
        <p className={`num text-xs font-semibold ${chgClass}`}>
          {up || down ? (
            <span aria-hidden className="mr-0.5">
              {up ? '▲' : '▼'}
            </span>
          ) : null}
          {formatChg(chg)}
        </p>
      </div>
    </div>
  )
}
