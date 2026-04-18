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
          <p className="text-sm font-semibold tracking-tight text-zinc-100">
            Related movers
            <span className="ml-2 text-xs font-semibold tracking-tight text-zinc-400">{selected.symbol}</span>
          </p>
          <p className="text-[11px] text-zinc-600">{selected.name}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {loading ? (
        <RelatedStrengthSkeleton />
      ) : error ? (
        <div className="text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Leaders</p>
            <ul className="mt-2 space-y-2">
              {(data?.leaders ?? []).map((r) => (
                <li key={r.symbol} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold tracking-tight text-zinc-200">{r.symbol}</span>
                  <span className="text-sm tabular-nums font-medium tracking-tight text-[color:var(--color-success)]">
                    {formatPct(r.changePercent)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Laggards</p>
            <ul className="mt-2 space-y-2">
              {(data?.laggards ?? []).map((r) => (
                <li key={r.symbol} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold tracking-tight text-zinc-200">{r.symbol}</span>
                  <span className="text-sm tabular-nums font-medium tracking-tight text-rose-300">
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
