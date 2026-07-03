import { useMemo } from 'react'
import { VolHeatmapSkeleton } from './DataSkeleton'

// Heat = attention: high vol reads hot (down), calm reads cool (up), mid is a warn tone.
// Intensity comes from graded OPACITY over the surface panel — never saturated fills.
function tone(score) {
  if (score == null || !Number.isFinite(score)) {
    return { rgb: null, opacity: 0, border: 'border-line' }
  }
  if (score >= 70) return { rgb: '255,97,97', opacity: 0.14, border: 'border-down/45' } // down
  if (score >= 45) return { rgb: '255,194,75', opacity: 0.12, border: 'border-warn/40' } // warn
  return { rgb: '61,220,151', opacity: 0.1, border: 'border-up/40' } // up
}

export function VolatilityHeatmapWidget({ data, loading, error }) {
  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data])

  if (loading && rows.length === 0) return <VolHeatmapSkeleton />
  if (error) return <div className="text-sm text-down">{error}</div>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((r) => {
          const t = tone(r.score)
          return (
            <div
              key={r.symbol}
              className={[
                'relative flex min-h-[5.5rem] min-w-0 flex-col rounded-xl border bg-surface-1 px-3.5 py-3',
                t.border,
              ].join(' ')}
            >
              {t.rgb ? (
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ background: `rgba(${t.rgb},${t.opacity})` }}
                  aria-hidden
                />
              ) : null}
              <div className="relative flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">
                  {r.label ?? r.symbol}
                </span>
                <span className="eyebrow shrink-0">1h</span>
              </div>
              <div className="relative mt-2 min-w-0 space-y-0.5">
                <p className="num text-lg font-semibold text-ink">
                  {r.expectedVolNextHourPct == null ? '—' : `${r.expectedVolNextHourPct.toFixed(2)}%`}
                </p>
                <p className="num text-[11px] font-medium text-ink-2">
                  {r.volumeSpike == null ? '' : `${r.volumeSpike.toFixed(2)}× vs avg vol`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-3">
        Expected vol is a short-horizon proxy (realized 5m returns + volume spike).
      </p>
    </div>
  )
}
