import { useMemo } from 'react'
import { VolHeatmapSkeleton } from './DataSkeleton'

function tone(score) {
  if (score == null || !Number.isFinite(score)) return { bg: 'bg-white/5', border: 'border-white/10' }
  if (score >= 70) return { bg: 'bg-rose-500/15', border: 'border-rose-400/45' }
  if (score >= 45) return { bg: 'bg-amber-500/15', border: 'border-amber-300/45' }
  return { bg: 'bg-emerald-500/10', border: 'border-emerald-300/40' }
}

export function VolatilityHeatmapWidget({ data, loading, error }) {
  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data])

  if (loading && rows.length === 0) return <VolHeatmapSkeleton />
  if (error) return <div className="text-sm text-rose-200">{error}</div>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((r) => {
          const t = tone(r.score)
          return (
            <div
              key={r.symbol}
              className={[
                'relative flex min-h-[5.5rem] min-w-0 flex-col rounded-xl border px-3.5 py-3 shadow-[0_10px_30px_-22px_rgba(0,0,0,0.9)]',
                t.bg,
                t.border,
              ].join(' ')}
              style={{
                boxShadow:
                  r.score == null || !Number.isFinite(r.score)
                    ? undefined
                    : r.score >= 70
                      ? '0 0 0 1px rgba(251,113,133,0.10), 0 18px 60px -38px rgba(0,0,0,0.95)'
                      : r.score >= 45
                        ? '0 0 0 1px rgba(252,211,77,0.10), 0 18px 60px -38px rgba(0,0,0,0.95)'
                        : '0 0 0 1px rgba(52,211,153,0.08), 0 18px 60px -38px rgba(0,0,0,0.95)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  boxShadow:
                    r.score == null || !Number.isFinite(r.score)
                      ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                      : r.score >= 70
                        ? 'inset 0 1px 0 rgba(251,113,133,0.35)'
                        : r.score >= 45
                          ? 'inset 0 1px 0 rgba(252,211,77,0.35)'
                          : 'inset 0 1px 0 rgba(52,211,153,0.28)',
                }}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug tracking-tight text-zinc-100">
                  {r.label ?? r.symbol}
                </span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500">1h</span>
              </div>
              <div className="mt-2 min-w-0 space-y-0.5">
                <p className="text-lg font-semibold tabular-nums tracking-tight text-zinc-50">
                  {r.expectedVolNextHourPct == null ? '—' : `${r.expectedVolNextHourPct.toFixed(2)}%`}
                </p>
                <p className="text-[11px] font-medium tabular-nums tracking-tight text-zinc-400">
                  {r.volumeSpike == null ? '' : `${r.volumeSpike.toFixed(2)}× vs avg vol`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        Expected vol is a short-horizon proxy (realized 5m returns + volume spike).
      </p>
    </div>
  )
}
