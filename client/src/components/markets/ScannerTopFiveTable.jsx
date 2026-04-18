import { ArrowUpRight } from 'lucide-react'

function formatPrice(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return String(n)
  }
}

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function ScannerTopFiveTable({
  title,
  subtitle,
  rows,
  navigate,
  columns,
  hideHeader = false,
  containerClassName = '',
}) {
  const onKey = (e, ticker) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/analysis/${ticker}`)
    }
  }

  return (
    <div
      className={[
        'max-h-[22rem] overflow-auto rounded-xl border border-white/10 bg-white/[0.03]',
        containerClassName,
      ].join(' ')}
    >
      {!hideHeader && (title || subtitle) ? (
        <div className="border-b border-border-subtle px-4 py-3">
          {title ? <p className="text-sm font-semibold text-zinc-100">{title}</p> : null}
          {subtitle ? <p className="mt-0.5 text-[11px] text-zinc-600">{subtitle}</p> : null}
        </div>
      ) : null}
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
          <tr className="border-b border-border-subtle">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 font-medium ${c.right ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/70">
          {(rows ?? []).map((r) => (
            <tr
              key={r.ticker}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/analysis/${r.ticker}`)}
              onKeyDown={(e) => onKey(e, r.ticker)}
              className="group cursor-pointer outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-white/10"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={['px-4 py-2.5 tabular-nums text-zinc-300', c.right ? 'text-right' : ''].join(' ')}
                >
                  {c.key === 'ticker' ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-zinc-100">
                      {r.ticker}
                      <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" aria-hidden />
                    </span>
                  ) : c.render ? (
                    c.render(r)
                  ) : (
                    (r[c.key] ?? '—')
                  )}
                </td>
              ))}
            </tr>
          ))}
          {(!rows || rows.length === 0) && (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={columns.length}>
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function formatVolRatio(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${n.toFixed(2)}×`
}

export { formatPrice, formatPct }
