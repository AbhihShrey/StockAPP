import { TrendingDown, TrendingUp, X } from 'lucide-react'
import { RelatedStrengthSkeleton } from './DataSkeleton'

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${Number(n).toFixed(2)}%`
}

export function RelatedStrengthWidget({ selected, data, loading, error, onClose }) {
  if (!selected) return null

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-ink">
            Related movers
            <span className="num ml-2 text-xs font-semibold text-ink-2">{selected.symbol}</span>
          </p>
          <p className="text-[11px] text-ink-3">{selected.name}</p>
        </div>
        <button type="button" className="btn-ghost h-8 px-2.5 text-xs" onClick={onClose}>
          <X className="size-3.5" />
          Close
        </button>
      </div>

      {loading ? (
        <RelatedStrengthSkeleton />
      ) : error ? (
        <div className="text-sm text-down">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface-2 p-3.5">
            <p className="eyebrow flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-up" />
              Leaders
            </p>
            <ul className="mt-2 space-y-2">
              {(data?.leaders ?? []).map((r) => (
                <li key={r.symbol} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink-2">{r.symbol}</span>
                  <span className="num flex items-center gap-1 text-sm font-medium text-up">
                    <TrendingUp className="size-3" aria-hidden />
                    {formatPct(r.changePercent)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-line bg-surface-2 p-3.5">
            <p className="eyebrow flex items-center gap-1.5">
              <TrendingDown className="size-3.5 text-down" />
              Laggards
            </p>
            <ul className="mt-2 space-y-2">
              {(data?.laggards ?? []).map((r) => (
                <li key={r.symbol} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink-2">{r.symbol}</span>
                  <span className="num flex items-center gap-1 text-sm font-medium text-down">
                    <TrendingDown className="size-3" aria-hidden />
                    {formatPct(r.changePercent)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
