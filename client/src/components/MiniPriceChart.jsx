import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiUrl } from '../lib/apiBase'

const TOOLTIP_STYLE = {
  background: 'rgba(20, 20, 24, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '0.75rem',
  backdropFilter: 'blur(18px) saturate(170%)',
  WebkitBackdropFilter: 'blur(18px) saturate(170%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 24px rgba(0,0,0,0.35)',
  color: 'oklch(0.92 0 0)',
  fontSize: '12px',
  padding: '8px 10px',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    if (pts.length < 2) return 'oklch(0.72 0.17 165)'
    const first = pts[0].close
    const last = pts[pts.length - 1].close
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 'oklch(0.72 0.17 165)'
    return last >= first ? 'oklch(0.72 0.17 165)' : 'oklch(0.64 0.19 25)'
  }, [pts])

  return (
    <div className="glass-bar rounded-xl border border-white/10 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Last 90d</p>
        <p className="text-[11px] font-medium text-zinc-600">{symbol}</p>
      </div>
      <div className="mt-2" style={{ height }}>
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">Loading chart…</p>
        ) : err ? (
          <p className="flex h-full items-center justify-center text-sm text-amber-200/90">{err}</p>
        ) : pts.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pts} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
              />
              <Line type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">No chart data.</p>
        )}
      </div>
    </div>
  )
}

