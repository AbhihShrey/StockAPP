import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiUrl } from '../lib/apiBase'

/* Chart colors are hex-in-JS by design-system exception. */
const UP_STROKE = '#3DDC97'
const DOWN_STROKE = '#FF6161'

const TOOLTIP_STYLE = {
  background: 'rgba(27, 23, 19, 0.94)',
  border: '1px solid rgba(244, 232, 216, 0.16)',
  borderRadius: '10px',
  color: '#F4EFE9',
  fontSize: '12px',
  padding: '8px 10px',
  fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
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

export function MiniPriceChart({ symbol, height = 140 }) {
  const [raw, setRaw] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const range = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 90)
    return { start: isoDate(start), end: isoDate(end) }
  }, [])

  useEffect(() => {
    if (!symbol) return undefined
    let cancelled = false
    setLoading(true)
    setErr(null)
    const q = new URLSearchParams({ symbol, start: range.start, end: range.end })
    fetch(apiUrl(`/api/vwap?${q.toString()}`))
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.message ?? `Price request failed (${res.status})`)
        return j
      })
      .then((j) => {
        if (!cancelled) setRaw(j)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load price series')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbol, range.end, range.start])

  const pts = useMemo(() => {
    const series = raw?.series
    if (!Array.isArray(series)) return []
    const mapped = series
      .map((p) => ({ t: String(p.date).slice(5, 10), close: p.close }))
      .filter((p) => typeof p.close === 'number' && Number.isFinite(p.close))
    return downsample(mapped, 96)
  }, [raw])

  const stroke = useMemo(() => {
    if (pts.length < 2) return UP_STROKE
    const first = pts[0].close
    const last = pts[pts.length - 1].close
    if (!Number.isFinite(first) || !Number.isFinite(last)) return UP_STROKE
    return last >= first ? UP_STROKE : DOWN_STROKE
  }, [pts])

  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Last 90d</p>
        <p className="num text-[11px] font-medium text-ink-3">{symbol}</p>
      </div>
      <div className="mt-2" style={{ height }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="skeleton h-full w-full" aria-busy aria-label="Loading chart" />
          </div>
        ) : err ? (
          <p className="flex h-full items-center justify-center px-3 text-center text-sm text-warn">{err}</p>
        ) : pts.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pts} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#837A6F' }}
                formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
              />
              <Line type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-ink-3">No chart data.</p>
        )}
      </div>
    </div>
  )
}
