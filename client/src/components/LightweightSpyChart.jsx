import { AreaSeries, createChart, CrosshairMode, LineSeries } from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { getChartStyle } from '../lib/prefs'
import { useChartTheme } from '../lib/theme'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function downsample(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points
  const step = Math.ceil(points.length / maxPoints)
  const out = []
  for (let i = 0; i < points.length; i += step) out.push(points[i])
  const last = points[points.length - 1]
  if (out[out.length - 1]?.time !== last?.time) out.push(last)
  return out
}

function chartColors(isLight) {
  return {
    textColor: isLight ? 'rgba(63,63,70,0.85)' : 'rgba(228,228,231,0.85)',
    gridColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)',
  }
}

export function LightweightSpyChart({ symbol = 'SPY' }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const dataRef = useRef([])
  const [raw, setRaw] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const theme = useChartTheme()
  const isLight = theme === 'light'
  const [chartStyle, setChartStyle] = useState(getChartStyle)

  useEffect(() => {
    function onPref(e) {
      if (e.detail?.key === 'chartStyle') setChartStyle(e.detail.value)
    }
    window.addEventListener('ember-prefs-changed', onPref)
    return () => window.removeEventListener('ember-prefs-changed', onPref)
  }, [])

  const range = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1)
    return { start: isoDate(start), end: isoDate(end) }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    const q = new URLSearchParams({ symbol, start: range.start, end: range.end })
    fetch(apiUrl(`/api/vwap?${q.toString()}`))
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.message ?? `SPY chart request failed (${res.status})`)
        return j
      })
      .then((j) => {
        if (!cancelled) setRaw(j)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load chart')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.end, range.start, symbol])

  const data = useMemo(() => {
    const s = raw?.series
    if (!Array.isArray(s)) return []
    const pts = s
      .map((p) => ({
        time: String(p.date).slice(0, 10),
        value: p.close,
      }))
      .filter((p) => typeof p.value === 'number' && Number.isFinite(p.value))
    return downsample(pts, 360)
  }, [raw])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (err) {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
      return
    }

    const { textColor, gridColor } = chartColors(isLight)
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.06 },
      },
      timeScale: { borderVisible: false, fixLeftEdge: true },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: (p) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(p),
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    })

    const seriesOpts = chartStyle === 'line'
      ? { color: 'rgba(52,211,153,0.95)', lineWidth: 3 }
      : { topColor: 'rgba(34,197,94,0.32)', bottomColor: 'rgba(34,197,94,0.02)', lineColor: 'rgba(52,211,153,0.9)', lineWidth: 2 }
    const area = chart.addSeries(chartStyle === 'line' ? LineSeries : AreaSeries, seriesOpts)

    chartRef.current = chart
    seriesRef.current = area

    // Repopulate immediately if data was already loaded (e.g. after style change)
    if (dataRef.current?.length) {
      area.setData(dataRef.current)
      chart.timeScale().fitContent()
    }

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [err, chartStyle])

  useEffect(() => {
    dataRef.current = data
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return
    if (!data.length) return
    series.setData(data)
    chart.timeScale().fitContent()
  }, [data])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const { textColor, gridColor } = chartColors(isLight)
    chart.applyOptions({
      layout: { textColor },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
    })
  }, [isLight])

  return (
    <div className="relative h-[26rem] w-full">
      <div ref={containerRef} className="absolute inset-0 min-h-0 w-full" />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-1/20 backdrop-blur-[1px]">
          <p className="text-sm text-zinc-500">Loading {symbol}…</p>
        </div>
      ) : null}
      {err ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-1/30 backdrop-blur-[1px]">
          <p className="px-4 text-center text-sm text-amber-200/90">{err}</p>
        </div>
      ) : null}
    </div>
  )
}

