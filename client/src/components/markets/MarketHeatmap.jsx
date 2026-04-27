import { useCallback, useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../../lib/apiBase'

const POLL_MS = 60_000

function colorFor(pct) {
  // Flat / unknown → neutral zinc, blends with site chrome
  if (pct == null || !Number.isFinite(pct)) return 'oklch(0.28 0.005 250)'
  const clamped = Math.max(-5, Math.min(5, pct))
  const intensity = Math.min(1, Math.abs(clamped) / 4) // 0..1
  if (Math.abs(clamped) < 0.05) return 'oklch(0.28 0.005 250)'
  if (clamped >= 0) {
    // muted emerald — low chroma so it harmonizes with zinc panels
    const l = 0.30 + intensity * 0.14
    const c = 0.025 + intensity * 0.075
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 165)`
  }
  // muted rose
  const l = 0.30 + intensity * 0.13
  const c = 0.030 + intensity * 0.090
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 22)`
}

function HeatmapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const pct = d.changePercent
  const sign = pct >= 0 ? '+' : ''
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900/95 px-3 py-2 text-xs shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)] backdrop-blur">
      <p className="text-sm font-semibold tracking-tight text-zinc-100">{d.symbol}</p>
      <p className={`tabular-nums ${pct >= 0 ? 'text-emerald-300/90' : 'text-rose-300/90'}`}>
        {sign}{pct.toFixed(2)}%
      </p>
      {d.price != null ? <p className="tabular-nums text-zinc-400">${d.price.toFixed(2)}</p> : null}
    </div>
  )
}

function HeatmapTile(props) {
  const { x, y, width, height, onClick } = props
  if (width == null || height == null || width <= 0 || height <= 0) return null
  const symbol = props.symbol ?? props.name ?? props.payload?.symbol
  const pct = props.changePercent ?? props.payload?.changePercent
  const fill = colorFor(pct)
  const showLabel = width > 32 && height > 20
  const showPct = width > 52 && height > 36
  const sign = pct != null && pct >= 0 ? '+' : ''
  // Browser-rendered HTML inside foreignObject → sharp, anti-aliased typography
  // (SVG <text> looks chunky at small sizes; this renders identically to the rest of the site).
  const sideLen = Math.sqrt(width * height)
  const symFs = Math.min(15, Math.max(10, sideLen / 7))
  const pctFs = Math.min(11, Math.max(9, sideLen / 11))
  return (
    <g
      onClick={() => symbol && onClick?.(symbol)}
      style={{ cursor: symbol ? 'pointer' : 'default' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }}
      />
      {showLabel && symbol ? (
        <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '2px',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                color: 'rgba(244,244,245,0.95)',
                fontSize: `${symFs}px`,
                fontWeight: 600,
                letterSpacing: '0.01em',
                lineHeight: 1,
              }}
            >
              {symbol}
            </div>
            {showPct && pct != null ? (
              <div
                style={{
                  color: 'rgba(228,228,231,0.78)',
                  fontSize: `${pctFs}px`,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {sign}{pct.toFixed(2)}%
              </div>
            ) : null}
          </div>
        </foreignObject>
      ) : null}
    </g>
  )
}

export function MarketHeatmap() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [asOf, setAsOf] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/markets-heatmap?limit=120'))
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load heatmap')
      setRows(Array.isArray(json.rows) ? json.rows : [])
      setAsOf(json.asOf ?? null)
      setError(null)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = window.setInterval(() => load(true), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  const data = useMemo(() => {
    return rows
      .filter((r) => r.symbol && Number.isFinite(r.changePercent))
      .map((r) => ({
        ...r,
        // Tile size — use abs(return) but floor at 0.15 so flat names still render.
        size: Math.max(0.15, Math.abs(r.changePercent)),
      }))
  }, [rows])

  if (loading) {
    return <div className="h-[560px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
        {error}
      </div>
    )
  }
  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center text-sm text-zinc-500">
        No heatmap data.
      </div>
    )
  }

  const advancers = data.filter((d) => d.changePercent > 0).length
  const decliners = data.filter((d) => d.changePercent < 0).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span>S&amp;P 500 — top {data.length} by |% change|</span>
          <span className="hidden h-3 w-px bg-white/10 sm:inline-block" />
          <span className="hidden tabular-nums text-emerald-300/80 sm:inline">▲ {advancers}</span>
          <span className="hidden tabular-nums text-rose-300/80 sm:inline">▼ {decliners}</span>
        </div>
        {asOf ? (
          <span className="tabular-nums text-zinc-500">
            as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
      </div>
      <div className="h-[560px] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-neutral-950/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="symbol"
            stroke="rgba(255,255,255,0.05)"
            content={<HeatmapTile onClick={(sym) => navigate(`/analysis/${sym}`)} />}
            isAnimationActive={false}
          >
            <Tooltip content={<HeatmapTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500">
        <span>Tile size = |return|, color = direction</span>
        <div className="flex items-center gap-2.5">
          <span className="tabular-nums text-zinc-500">−4%</span>
          <span className="flex h-2.5 overflow-hidden rounded-sm">
            {[-4, -2.5, -1, -0.25, 0.25, 1, 2.5, 4].map((p) => (
              <span key={p} className="block w-5" style={{ background: colorFor(p) }} />
            ))}
          </span>
          <span className="tabular-nums text-zinc-500">+4%</span>
        </div>
      </div>
    </div>
  )
}
