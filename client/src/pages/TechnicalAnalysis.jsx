import { RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChartExpandModal } from '../components/ChartExpandModal'
import { MagneticButton } from '../components/MagneticButton'
import { TradingViewAdvancedChart } from '../components/TradingViewAdvancedChart'
import { TradingViewSymbolOverviewSimple } from '../components/TradingViewSymbolOverviewSimple'
import { TradingViewTickerTape } from '../components/TradingViewTickerTape'
import { apiUrl } from '../lib/apiBase'
import { MAG7_TICKERS, OVERVIEW_TICKERS } from '../lib/tradingViewSymbol'

const TILE_CHART_HEIGHT = 198
const GRID_POLL_MS = 30_000

function MiniChartCard({ ticker, score, onExpand, refreshKey }) {
  const showScore = score !== undefined
  const onKey = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onExpand(ticker)
      }
    },
    [onExpand, ticker],
  )

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onExpand(ticker)}
      onKeyDown={onKey}
      className="group cursor-pointer rounded-xl border border-white/[0.08] bg-gradient-to-b from-surface-2/55 to-surface-1/85 p-3 shadow-lg shadow-black/40 outline-none transition hover:border-sky-500/55 hover:shadow-sky-500/10 focus-visible:ring-2 focus-visible:ring-sky-500/50"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-zinc-100">{ticker}</p>
        {showScore ? (
          <div className="text-right">
            <p className="text-[11px] text-zinc-500">
              Score{' '}
              <span className="font-mono text-sm font-semibold tabular-nums text-zinc-200">
                {score != null && Number.isFinite(score) ? score : '—'}
              </span>
            </p>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none w-full" style={{ height: TILE_CHART_HEIGHT }}>
        <TradingViewSymbolOverviewSimple
          key={`${ticker}-${refreshKey}`}
          ticker={ticker}
          height={TILE_CHART_HEIGHT}
          range="1M"
        />
      </div>
    </article>
  )
}

export function TechnicalAnalysis() {
  const { symbol: routeSymbol } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [expandTicker, setExpandTicker] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [gridRows, setGridRows] = useState([])
  const [showVwapStudy, setShowVwapStudy] = useState(true)

  const routeTicker = useMemo(
    () => (routeSymbol ? String(routeSymbol).toUpperCase().trim() : null),
    [routeSymbol],
  )

  useEffect(() => {
    setInput(routeTicker ?? '')
  }, [routeTicker])

  const loadChartsUniverse = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/charts-universe'))
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return
      setGridRows(Array.isArray(json.rows) ? json.rows : [])
    } catch {
      /* keep prior grid */
    }
  }, [])

  useEffect(() => {
    loadChartsUniverse()
    const id = window.setInterval(loadChartsUniverse, GRID_POLL_MS)
    return () => window.clearInterval(id)
  }, [loadChartsUniverse])

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const t = input.trim().toUpperCase()
      if (!t) {
        navigate('/charts')
        return
      }
      navigate(`/analysis/${t}`)
    },
    [input, navigate],
  )

  const showMainChart = Boolean(routeTicker)

  const quickCompareItems = useMemo(() => {
    const pool = [...MAG7_TICKERS, ...OVERVIEW_TICKERS]
    return pool.filter((t) => t !== routeTicker).slice(0, 8)
  }, [routeTicker])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Charts</h1>
        </header>
        <button
          type="button"
          onClick={() => {
            loadChartsUniverse()
            setRefreshKey((k) => k + 1)
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="size-4" aria-hidden />
          Refresh
        </button>
      </div>

      <TradingViewTickerTape />

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-1/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm sm:flex-row sm:items-center"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. AAPL)"
            className="w-full rounded-xl border border-border-subtle bg-surface-0/40 py-2.5 pl-10 pr-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/15"
            maxLength={12}
            aria-label="Stock ticker symbol"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <MagneticButton
            type="submit"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
          >
            Load chart
          </MagneticButton>
          {showMainChart ? (
            <button
              type="button"
              onClick={() => navigate('/charts')}
              className="rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              Overview
            </button>
          ) : null}
        </div>
      </form>

      {showMainChart ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="sr-only">Primary chart</h2>
              <p className="text-xs text-zinc-500">
                Routed at{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-zinc-400">
                  /analysis/{routeTicker}
                </code>
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                className="rounded border-border-subtle bg-surface-0/40"
                checked={showVwapStudy}
                onChange={(e) => setShowVwapStudy(e.target.checked)}
              />
              Show VWAP (TradingView study)
            </label>
          </div>
          <div className="h-[520px] w-full">
            <TradingViewAdvancedChart
              key={`main-${routeTicker}-${refreshKey}-${showVwapStudy ? 'v' : 'n'}`}
              ticker={routeTicker}
              height={520}
              showVwapStudy={showVwapStudy}
            />
          </div>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          Open a symbol from{' '}
          <Link to="/markets" className="text-accent hover:underline">
            Markets
          </Link>{' '}
          or search above.
        </p>
      )}

      {!showMainChart ? (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gridRows.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-zinc-500">
                No screener tickers yet — check the API or try refresh.
              </p>
            ) : (
              gridRows.map((row) => (
                <MiniChartCard
                  key={row.ticker}
                  ticker={row.ticker}
                  score={row.score ?? null}
                  onExpand={setExpandTicker}
                  refreshKey={refreshKey}
                />
              ))
            )}
          </div>
          <p className="text-center text-xs text-zinc-600">
            Up to 4 charts per row · 1‑month view · click for full TradingView tools
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">Quick compare</h2>
          <p className="text-sm text-zinc-500">Other liquid names — click a tile to expand.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickCompareItems.map((t) => (
              <MiniChartCard key={t} ticker={t} onExpand={setExpandTicker} refreshKey={refreshKey} />
            ))}
          </div>
        </section>
      )}

      <ChartExpandModal
        open={Boolean(expandTicker)}
        ticker={expandTicker}
        chartRefreshKey={refreshKey}
        showVwapStudy={showVwapStudy}
        onClose={() => setExpandTicker(null)}
      />
    </div>
  )
}
