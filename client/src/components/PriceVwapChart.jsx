import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiUrl } from '../lib/apiBase'

const CLOSE_STROKE = '#48c78e'
const VWAP_STROKE = '#e0b16b'
const GRID_STROKE = 'rgba(244,232,216,0.06)'
const AXIS_TEXT = '#8b7f6d'
const TOOLTIP_STYLE = {
  background: 'rgba(20, 17, 14, 0.82)',
  border: '1px solid rgba(244, 232, 216, 0.16)',
  borderRadius: '0.75rem',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  color: '#F4EFE9',
  fontSize: '12px',
  padding: '8px 10px',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

function downsample(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  const out = []
  for (let i = 0; i < points.length; i += step) out.push(points[i])
  const last = points[points.length - 1]
  if (out[out.length - 1]?.t !== last?.t) out.push(last)
  return out
}

/**
 * Close + cumulative daily VWAP (from Node API / FMP OHLCV). VWAP line is dashed gold for contrast.
 */
export function PriceVwapChart({
  symbol,
  start,
  end,
  enabled = true,
  title = 'Price vs VWAP',
  subtitle = 'Daily close and cumulative VWAP for the selected window (API + cache).',
  className = '',
}) {
  const [raw, setRaw] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showVwapLine, setShowVwapLine] = useState(true)

  useEffect(() => {
    if (!enabled || !symbol || !start || !end) return undefined
    let cancelled = false
    setLoading(true)
    setErr(null)
    const q = new URLSearchParams({ symbol, start, end })
    fetch(apiUrl(`/api/vwap?${q.toString()}`))
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.message ?? `VWAP request failed (${res.status})`)
        return j
      })
      .then((j) => {
        if (!cancelled) setRaw(j)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load VWAP')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbol, start, end, enabled])

  const chartData = useMemo(() => {
    const series = raw?.series
    if (!Array.isArray(series)) return []
    const pts = series.map((p) => ({
      t: String(p.date).slice(0, 10),
      close: p.close,
      vwap: showVwapLine ? p.vwap : null,
    }))
    return downsample(pts, 420)
  }, [raw, showVwapLine])

  if (!enabled || !symbol) return null

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? <h3 className="text-sm font-semibold text-ink">{title}</h3> : null}
          {subtitle ? <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p> : null}
          {raw?.methodology ? <p className="mt-1 text-[11px] text-ink-3">{raw.methodology}</p> : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            className="rounded border-line bg-surface-2 accent-ember"
            checked={showVwapLine}
            onChange={(e) => setShowVwapLine(e.target.checked)}
          />
          Show VWAP
        </label>
      </div>

      <div className="mt-4 h-72 w-full">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-ink-3">Loading VWAP series…</p>
        ) : err ? (
          <p className="flex h-full items-center justify-center text-sm text-warn">{err}</p>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="t" tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: AXIS_TEXT }}
                formatter={(value, name) =>
                  typeof value === 'number' ? [`$${value.toFixed(2)}`, name] : [value, name]
                }
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={(value) => <span className="text-ink-2">{value}</span>}
              />
              <Line type="monotone" dataKey="close" name="Close" stroke={CLOSE_STROKE} strokeWidth={2} dot={false} />
              {showVwapLine ? (
                <Line
                  type="monotone"
                  dataKey="vwap"
                  name="VWAP"
                  stroke={VWAP_STROKE}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-ink-3">No OHLCV data.</p>
        )}
      </div>
    </div>
  )
}
