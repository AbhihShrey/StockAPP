import { AlertTriangle, RefreshCw, RotateCcw, Search, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnalystCoveragePanel } from '../components/AnalystCoveragePanel'
import { ChartExpandModal } from '../components/ChartExpandModal'
import { FundamentalsPanel } from '../components/FundamentalsPanel'
import { MagneticButton } from '../components/MagneticButton'
import { TradingViewAdvancedChart } from '../components/TradingViewAdvancedChart'
import { TradingViewSymbolOverviewSimple } from '../components/TradingViewSymbolOverviewSimple'
import { TradingViewTickerTape } from '../components/TradingViewTickerTape'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'
import { MAG7_TICKERS, OVERVIEW_TICKERS } from '../lib/tradingViewSymbol'

const TILE_CHART_HEIGHT = 198
const GRID_POLL_MS = 30_000
const COMPARE_SYMBOLS_KEY = 'compare_panel_symbols'
const COMPARE_SLOT_COUNT = 8

const DEFAULT_COMPARE_SYMBOLS = (() => {
  const seen = new Set()
  const out = []
  for (const sym of [...MAG7_TICKERS, ...OVERVIEW_TICKERS]) {
    const s = String(sym).toUpperCase()
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length === COMPARE_SLOT_COUNT) break
  }
  return out
})()

function loadStoredCompareSymbols() {
  try {
    const raw = window.localStorage.getItem(COMPARE_SYMBOLS_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return null
    return arr
      .filter((s) => typeof s === 'string')
      .map((s) => s.toUpperCase().trim())
      .filter(Boolean)
      .slice(0, COMPARE_SLOT_COUNT)
  } catch { return null }
}

function saveStoredCompareSymbols(symbols) {
  try { window.localStorage.setItem(COMPARE_SYMBOLS_KEY, JSON.stringify(symbols)) } catch {}
}

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
      className="glass-bar card-hover group cursor-pointer rounded-xl border border-white/[0.08] p-3 shadow-lg shadow-black/40 outline-none transition hover:border-sky-500/55 hover:shadow-sky-500/10 focus-visible:ring-2 focus-visible:ring-sky-500/50"
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

function padSlots(symbols) {
  const out = symbols.slice(0, COMPARE_SLOT_COUNT)
  while (out.length < COMPARE_SLOT_COUNT) out.push('')
  return out
}

function QuickComparePanel({ symbols, routeTicker, onExpand, refreshKey, token, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => padSlots(symbols))
  const [invalid, setInvalid] = useState(/** @type {Set<string>} */(new Set()))
  const [validating, setValidating] = useState(false)
  const validateAbortRef = useRef(0)

  useEffect(() => {
    if (!editing) setDraft(padSlots(symbols))
  }, [symbols, editing])

  const enterEdit = () => {
    setDraft(padSlots(symbols))
    setInvalid(new Set())
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(padSlots(symbols))
    setInvalid(new Set())
  }

  const resetToDefaults = () => {
    setDraft(padSlots(DEFAULT_COMPARE_SYMBOLS))
    setInvalid(new Set())
  }

  const updateSlot = (i, value) => {
    setDraft((prev) => {
      const next = [...prev]
      next[i] = value.toUpperCase()
      return next
    })
  }

  const clearSlot = (i) => {
    setDraft((prev) => {
      const next = [...prev]
      next[i] = ''
      return next
    })
    setInvalid((prev) => {
      const sym = (draft[i] || '').toUpperCase()
      if (!prev.has(sym)) return prev
      const next = new Set(prev)
      next.delete(sym)
      return next
    })
  }

  const save = useCallback(async () => {
    const cleaned = draft.map((s) => s.trim().toUpperCase()).filter(Boolean)
    const unique = [...new Set(cleaned)].slice(0, COMPARE_SLOT_COUNT)

    setValidating(true)
    const myId = ++validateAbortRef.current
    const bad = new Set()
    try {
      await Promise.all(unique.map(async (sym) => {
        try {
          const res = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(sym)}&limit=10`), {
            headers: authHeaders(token),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok || !json.ok) { bad.add(sym); return }
          const list = Array.isArray(json.results) ? json.results : []
          if (!list.some((r) => String(r.symbol).toUpperCase() === sym)) bad.add(sym)
        } catch {
          bad.add(sym)
        }
      }))
    } finally {
      if (myId !== validateAbortRef.current) return
      setValidating(false)
    }

    setInvalid(bad)
    saveStoredCompareSymbols(unique)
    onSave(unique)
    setEditing(false)
  }, [draft, token, onSave])

  if (!editing) {
    const visible = symbols.filter((t) => t && t !== routeTicker)
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Quick compare</h2>
          <button
            type="button"
            onClick={enterEdit}
            title="Configure quick compare"
            aria-label="Configure quick compare"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <Settings className="size-4" />
          </button>
        </div>
        {visible.length === 0 ? (
          <p className="rounded-xl border border-border-subtle bg-surface-1/40 px-4 py-6 text-center text-xs text-zinc-500">
            No symbols configured. Click the gear icon to add some.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((t) => (
              <MiniChartCard key={t} ticker={t} onExpand={onExpand} refreshKey={refreshKey} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Quick compare — edit</h2>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-zinc-400 underline-offset-4 transition hover:text-zinc-200 hover:underline"
        >
          <RotateCcw className="mr-1 inline size-3" /> Reset to defaults
        </button>
      </div>
      <div className="rounded-2xl border border-border-subtle bg-surface-1/40 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {draft.map((sym, i) => {
            const upper = sym.trim().toUpperCase()
            const isInvalid = upper && invalid.has(upper)
            return (
              <div
                key={i}
                className={[
                  'flex items-center gap-1.5 rounded-lg border bg-surface-0/40 px-2 py-1.5 transition',
                  isInvalid ? 'border-rose-500/40' : 'border-white/10 focus-within:border-accent/40',
                ].join(' ')}
              >
                <span className="w-5 shrink-0 text-center text-[10px] font-medium text-zinc-600">{i + 1}</span>
                <input
                  value={sym}
                  onChange={(e) => updateSlot(i, e.target.value)}
                  placeholder="SYMBOL"
                  maxLength={12}
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                {isInvalid && (
                  <AlertTriangle className="size-3.5 shrink-0 text-rose-400" aria-label={`${upper} not found`} />
                )}
                {sym && (
                  <button
                    type="button"
                    onClick={() => clearSlot(i)}
                    title="Clear slot"
                    aria-label="Clear slot"
                    className="rounded p-0.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancel}
            className="text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={validating}
            className="glass-btn--accent rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {validating ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

export function TechnicalAnalysis() {
  const { symbol: routeSymbol } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [expandTicker, setExpandTicker] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [gridRows, setGridRows] = useState([])
  const [showVwapStudy, setShowVwapStudy] = useState(true)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [compareSymbols, setCompareSymbols] = useState(
    () => loadStoredCompareSymbols() ?? DEFAULT_COMPARE_SYMBOLS,
  )

  const routeTicker = useMemo(
    () => (routeSymbol ? String(routeSymbol).toUpperCase().trim() : null),
    [routeSymbol],
  )

  useEffect(() => {
    setInput(routeTicker ?? '')
  }, [routeTicker])

  useEffect(() => {
    if (!routeTicker) { setCurrentPrice(null); return }
    let cancelled = false
    async function loadQuote() {
      try {
        const res = await fetch(apiUrl(`/api/quotes?symbols=${routeTicker}`), { headers: authHeaders(token) })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        const q = json.quotes?.[0]
        setCurrentPrice(q?.price ?? null)
      } catch {
        if (!cancelled) setCurrentPrice(null)
      }
    }
    loadQuote()
    return () => { cancelled = true }
  }, [routeTicker, token])

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
            className="glass-btn--accent rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            Load chart
          </MagneticButton>
          {showMainChart ? (
            <button
              type="button"
              onClick={() => navigate('/charts')}
              className="glass-btn rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              Overview
            </button>
          ) : null}
        </div>
      </form>

      {showMainChart ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="sr-only">Primary chart — {routeTicker}</h2>
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
      ) : null}

      {showMainChart ? (
        <FundamentalsPanel symbol={routeTicker} />
      ) : null}

      {showMainChart ? (
        <AnalystCoveragePanel symbol={routeTicker} currentPrice={currentPrice} />
      ) : null}

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
                  onExpand={(t) => navigate(`/analysis/${encodeURIComponent(t)}`)}
                  refreshKey={refreshKey}
                />
              ))
            )}
          </div>
        </section>
      ) : (
        <QuickComparePanel
          symbols={compareSymbols}
          routeTicker={routeTicker}
          onExpand={setExpandTicker}
          refreshKey={refreshKey}
          token={token}
          onSave={setCompareSymbols}
        />
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
