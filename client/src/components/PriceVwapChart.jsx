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

const CLOSE_STROKE = 'oklch(0.72 0.17 165)'
const VWAP_STROKE = '#c9a227'
const TOOLTIP_STYLE = {
  background: '#0c0e12',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '0.5rem',
  fontSize: '12px',
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
          {title ? <h3 className="text-sm font-semibold text-zinc-200">{title}</h3> : null}
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
          {raw?.methodology ? <p className="mt-1 text-[11px] text-zinc-600">{raw.methodology}</p> : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            className="rounded border-border-subtle bg-surface-0/40"
            checked={showVwapLine}
            onChange={(e) => setShowVwapLine(e.target.checked)}
          />
          Show VWAP
        </label>
      </div>

      <div className="mt-4 h-72 w-full">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">Loading VWAP series…</p>
        ) : err ? (
          <p className="flex h-full items-center justify-center text-sm text-amber-200/90">{err}</p>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="oklch(0.26 0.01 255 / 0.35)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value, name) =>
                  typeof value === 'number' ? [`$${value.toFixed(2)}`, name] : [value, name]
                }
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={(value) => <span className="text-zinc-400">{value}</span>}
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
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">No OHLCV data.</p>
        )}
      </div>
    </div>
  )
}
