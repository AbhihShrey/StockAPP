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
        'tbl max-h-[22rem] overflow-y-auto',
        containerClassName,
      ].join(' ')}
    >
      {!hideHeader && (title || subtitle) ? (
        <div className="border-b border-line px-3 py-3">
          {title ? (
            <p className="font-display text-sm font-semibold text-ink" style={{ fontStretch: '108%' }}>
              {title}
            </p>
          ) : null}
          {subtitle ? <p className="mt-0.5 text-[11px] text-ink-3">{subtitle}</p> : null}
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.right ? 'num' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr
              key={r.ticker}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/analysis/${r.ticker}`)}
              onKeyDown={(e) => onKey(e, r.ticker)}
              aria-label={`Open ${r.ticker} analysis`}
              className="group cursor-pointer focus-visible:bg-surface-3"
            >
              {columns.map((c) => (
                <td key={c.key} className={c.right ? 'num' : ''}>
                  {c.key === 'ticker' ? (
                    <span className="num inline-flex items-center gap-1.5 font-semibold text-ink">
                      {r.ticker}
                      <ArrowUpRight
                        className="size-3.5 text-ember opacity-0 transition-opacity duration-150 group-hover:opacity-80 group-focus-visible:opacity-80"
                        aria-hidden
                      />
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
              <td className="px-3 py-8 text-center text-sm text-ink-3" colSpan={columns.length}>
                No matches right now.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Helper exports are part of this module's public API (consumed by Markets.jsx).
// eslint-disable-next-line react-refresh/only-export-components
export function formatVolRatio(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${n.toFixed(2)}×`
}

// eslint-disable-next-line react-refresh/only-export-components
export { formatPrice, formatPct }
