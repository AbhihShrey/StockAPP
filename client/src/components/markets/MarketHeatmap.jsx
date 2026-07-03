import { useCallback, useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../../lib/apiBase'

const POLL_MS = 60_000

// Chart-layer colors (JS chart config is the one allowed place for hex/rgba).
const UP_RGB = '61, 220, 151' // #3DDC97
const DOWN_RGB = '255, 97, 97' // #FF6161
const NEUTRAL_FILL = 'rgba(244, 232, 216, 0.05)'
const TILE_STROKE = 'rgba(244, 232, 216, 0.06)'
const TILE_INK = 'rgba(244, 239, 233, 0.95)' // warm white, ≥4.5:1 on every tile intensity
const TILE_INK_SOFT = 'rgba(244, 232, 216, 0.8)'

function colorFor(pct) {
  // Flat / unknown → faint warm neutral that blends with the surface panels
  if (pct == null || !Number.isFinite(pct)) return NEUTRAL_FILL
  const clamped = Math.max(-5, Math.min(5, pct))
  if (Math.abs(clamped) < 0.05) return NEUTRAL_FILL
  const intensity = Math.min(1, Math.abs(clamped) / 4) // 0..1
  // Graded opacity over the dark surface — never a pure saturated fill.
  const alpha = 0.1 + intensity * 0.38
  return `rgba(${clamped >= 0 ? UP_RGB : DOWN_RGB}, ${alpha.toFixed(3)})`
}

function HeatmapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const pct = d.changePercent
  const sign = pct >= 0 ? '+' : ''
  return (
    <div className="glass rounded-xl border border-line-strong px-3 py-2 text-xs shadow-2xl shadow-black/50">
      <p className="num text-sm font-semibold text-ink">{d.symbol}</p>
      <p className={`num ${pct >= 0 ? 'text-up' : 'text-down'}`}>
        <span aria-hidden>{pct >= 0 ? '▲' : '▼'}</span> {sign}{pct.toFixed(2)}%
      </p>
      {d.price != null ? <p className="num text-ink-3">${d.price.toFixed(2)}</p> : null}
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
  const sideLen = Math.sqrt(width * height)
  const symFs = Math.min(15, Math.max(10, sideLen / 7))
  const pctFs = Math.min(11, Math.max(9, sideLen / 11))
  const radius = Math.min(6, Math.min(width, height) / 6)
  return (
    <g
      onClick={() => symbol && onClick?.(symbol)}
      style={{ cursor: symbol ? 'pointer' : 'default' }}
    >
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={radius}
        ry={radius}
        style={{ fill, stroke: TILE_STROKE, strokeWidth: 1 }}
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
              fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                color: TILE_INK,
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
                  color: TILE_INK_SOFT,
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
    return <div className="skeleton h-[440px] rounded-xl" aria-busy aria-label="Loading heatmap" />
  }
  if (error) {
    return (
      <div className="rounded-xl border border-down/25 bg-down/5 p-4 text-sm text-down">
        {error}
      </div>
    )
  }
  if (!data.length) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 py-10 text-center text-sm text-ink-3">
        No heatmap data yet.
      </div>
    )
  }

  const advancers = data.filter((d) => d.changePercent > 0).length
  const decliners = data.filter((d) => d.changePercent < 0).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-ink-3">
        <div className="flex items-center gap-3">
          <span>S&amp;P 500 — top {data.length} by |% change|</span>
          <span className="hidden h-3 w-px bg-line-strong sm:inline-block" aria-hidden />
          <span className="num hidden text-up sm:inline">▲ {advancers}</span>
          <span className="num hidden text-down sm:inline">▼ {decliners}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="num">−4%</span>
            <span className="flex h-2 overflow-hidden rounded-full border border-line" aria-hidden>
              {[-4, -2.5, -1, -0.25, 0.25, 1, 2.5, 4].map((p) => (
                <span key={p} className="block w-3.5" style={{ background: colorFor(p) }} />
              ))}
            </span>
            <span className="num">+4%</span>
          </div>
          {asOf ? (
            <span className="num">
              as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="h-[440px] w-full overflow-hidden rounded-xl border border-line bg-surface-2 p-1.5">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="symbol"
            stroke="transparent"
            content={<HeatmapTile onClick={(sym) => navigate(`/analysis/${sym}`)} />}
            isAnimationActive={false}
          >
            <Tooltip content={<HeatmapTooltip />} cursor={{ fill: 'rgba(244, 232, 216, 0.04)' }} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
