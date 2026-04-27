import {
  AlertTriangle,
  ChevronDown,
  DollarSign,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ConsensusPill } from '../components/AnalystCoveragePanel'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE_KEY = 'stockline_portfolios_v3'

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') ?? defaultStore() }
  catch { return defaultStore() }
}

function defaultStore() {
  const id = uid()
  return { activeId: id, portfolios: [blankPortfolio(id, 'My Portfolio', 100_000)] }
}

function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)) }

function uid() { return Math.random().toString(36).slice(2, 10) }

function blankPortfolio(id, name, budget) {
  return { id, name, budget: Number(budget), cash: Number(budget), positions: [] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  'oklch(0.72 0.17 165)', 'oklch(0.65 0.18 220)', 'oklch(0.70 0.18 260)',
  'oklch(0.68 0.17 300)', 'oklch(0.72 0.18 50)',  'oklch(0.68 0.18 90)',
  'oklch(0.65 0.17 0)',   'oklch(0.70 0.15 180)',
]

function fmt(n, d = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtDollar(n, showSign = true) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : (showSign && n > 0 ? '+' : '')
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtCash(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-100">{d.name}</p>
      <p className="text-zinc-400">{fmt(d.value, 1)}% of portfolio</p>
    </div>
  )
}

// ── New portfolio modal ───────────────────────────────────────────────────────

function NewPortfolioModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('100000')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const b = parseFloat(budget.replace(/,/g, ''))
    if (!name.trim()) return setError('Name is required')
    if (!Number.isFinite(b) || b <= 0) return setError('Budget must be a positive number')
    onCreate(name.trim(), b)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">New portfolio</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-zinc-300"><X className="size-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Portfolio name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tech focused, Long-term" autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 transition placeholder:text-zinc-600" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Starting budget ($)</label>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="100000"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/20 transition" />
            <p className="mt-1 text-[11px] text-zinc-600">This is the total virtual cash you start with. You can only spend what you have.</p>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-accent py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110">Create</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 transition hover:border-white/15 hover:text-zinc-200">Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ── Add position panel ────────────────────────────────────────────────────────

function AddPositionPanel({ cash, token, onBuy }) {
  const [symbol, setSymbol] = useState('')
  const [inputMode, setInputMode] = useState('dollars') // 'dollars' | 'shares'
  const [amount, setAmount] = useState('')
  const [fetchedPrice, setFetchedPrice] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [busySymbol, setBusySymbol] = useState('')

  const lookupPrice = useCallback(async (sym) => {
    if (!sym) return
    setFetching(true)
    setFetchedPrice(null)
    setFetchError(null)
    try {
      const res = await fetch(apiUrl(`/api/quotes?symbols=${sym}`), { headers: authHeaders(token) })
      const data = await res.json()
      const q = data.quotes?.[0]
      if (!q || q.price == null) { setFetchError('Symbol not found or no price data'); return }
      setFetchedPrice(q.price)
      setBusySymbol(sym)
    } catch { setFetchError('Network error') }
    finally { setFetching(false) }
  }, [token])

  const handleSymbolBlur = () => {
    const s = symbol.trim().toUpperCase()
    if (s && s !== busySymbol) lookupPrice(s)
  }

  const cost = (() => {
    if (fetchedPrice == null) return null
    const a = parseFloat(amount)
    if (!Number.isFinite(a) || a <= 0) return null
    return inputMode === 'dollars' ? a : a * fetchedPrice
  })()
  const shares = (() => {
    if (fetchedPrice == null || cost == null) return null
    return inputMode === 'dollars' ? cost / fetchedPrice : parseFloat(amount)
  })()

  const canBuy = cost != null && cost > 0 && cash >= cost && shares > 0

  const handleBuy = () => {
    if (!canBuy) return
    const sym = symbol.trim().toUpperCase()
    onBuy({ symbol: sym, shares, costBasis: cost, priceAtBuy: fetchedPrice })
    setSymbol(''); setAmount(''); setFetchedPrice(null); setFetchError(null); setBusySymbol('')
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Add position</h3>
      <div className="flex flex-wrap items-end gap-3">
        {/* Symbol */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Symbol</label>
          <div className="relative">
            <input
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setFetchedPrice(null); setBusySymbol('') }}
              onBlur={handleSymbolBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleSymbolBlur()}
              placeholder="AAPL"
              maxLength={12}
              className="w-28 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/20 transition placeholder:text-zinc-600"
            />
            {fetching && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-zinc-500" />}
          </div>
        </div>

        {/* Price display */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Live price</label>
          <div className="flex h-9 w-28 items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 font-mono text-sm">
            {fetchedPrice != null
              ? <span className="text-emerald-400">${fmt(fetchedPrice)}</span>
              : <span className="text-zinc-600">{fetching ? '…' : 'Enter symbol'}</span>}
          </div>
        </div>

        {/* Mode toggle + amount */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
            {[['dollars', '$ Amount'], ['shares', 'Shares']].map(([m, l]) => (
              <button key={m} type="button" onClick={() => { setInputMode(m); setAmount('') }}
                className={['rounded-md px-2.5 py-1 text-[11px] font-medium transition', inputMode === m ? 'bg-white/15 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'].join(' ')}>
                {l}
              </button>
            ))}
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canBuy && handleBuy()}
            placeholder={inputMode === 'dollars' ? 'e.g. 5000' : 'e.g. 10'}
            className="w-36 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 transition placeholder:text-zinc-600"
          />
        </div>

        {/* Buy summary + button */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Order summary</label>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-zinc-400 whitespace-nowrap">
              {cost != null && shares != null ? (
                <>{fmt(shares, 4)} sh · {fmtDollar(cost, false)}</>
              ) : <span className="text-zinc-600">—</span>}
            </div>
            <button
              type="button"
              onClick={handleBuy}
              disabled={!canBuy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Buy
            </button>
          </div>
        </div>
      </div>
      {fetchError && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-400"><AlertTriangle className="size-3.5" />{fetchError}</p>}
      {cost != null && cost > cash && <p className="mt-2 text-xs text-rose-400">Insufficient funds — you need {fmtDollar(cost - cash, false)} more.</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Portfolio() {
  const { token } = useAuth()
  const [store, setStore] = useState(loadStore)
  const [quotes, setQuotes] = useState({})
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [ratings, setRatings] = useState({})
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fetchRef = useRef(null)

  const active = store.portfolios.find((p) => p.id === store.activeId) ?? store.portfolios[0]

  const persist = (next) => { setStore(next); saveStore(next) }

  const setActive = (id) => persist({ ...store, activeId: id })

  const createPortfolio = (name, budget) => {
    const id = uid()
    const p = blankPortfolio(id, name, budget)
    persist({ ...store, activeId: id, portfolios: [...store.portfolios, p] })
  }

  const deletePortfolio = () => {
    if (store.portfolios.length <= 1) return
    const remaining = store.portfolios.filter((p) => p.id !== active.id)
    persist({ portfolios: remaining, activeId: remaining[0].id })
    setShowDeleteConfirm(false)
  }

  const resetPortfolio = () => {
    const updated = store.portfolios.map((p) =>
      p.id === active.id ? { ...p, cash: p.budget, positions: [] } : p
    )
    persist({ ...store, portfolios: updated })
    setShowResetConfirm(false)
  }

  const handleBuy = ({ symbol, shares, costBasis }) => {
    const updated = store.portfolios.map((p) => {
      if (p.id !== active.id) return p
      const existing = p.positions.find((pos) => pos.symbol === symbol)
      let positions
      if (existing) {
        positions = p.positions.map((pos) =>
          pos.symbol === symbol
            ? { ...pos, shares: pos.shares + shares, costBasis: pos.costBasis + costBasis }
            : pos
        )
      } else {
        positions = [...p.positions, { symbol, shares, costBasis }]
      }
      return { ...p, cash: p.cash - costBasis, positions }
    })
    persist({ ...store, portfolios: updated })
  }

  const handleSell = (symbol) => {
    const pos = active.positions.find((p) => p.symbol === symbol)
    if (!pos) return
    const q = quotes[symbol]
    const saleValue = q?.price != null ? q.price * pos.shares : pos.costBasis
    const updated = store.portfolios.map((p) => {
      if (p.id !== active.id) return p
      return {
        ...p,
        cash: p.cash + saleValue,
        positions: p.positions.filter((pos) => pos.symbol !== symbol),
      }
    })
    persist({ ...store, portfolios: updated })
  }

  const fetchQuotes = useCallback(async (positions) => {
    if (!positions.length) { setQuotes({}); return }
    const symbols = positions.map((p) => p.symbol).join(',')
    try {
      const res = await fetch(apiUrl(`/api/quotes?symbols=${symbols}`), { headers: authHeaders(token) })
      const data = await res.json()
      if (data.ok) {
        const map = {}
        for (const q of data.quotes) map[q.symbol] = q
        setQuotes(map)
      }
    } catch { /* silent */ }
  }, [token])

  useEffect(() => {
    if (!active?.positions?.length) { setQuotes({}); return }
    setQuotesLoading(true)
    fetchQuotes(active.positions).finally(() => setQuotesLoading(false))
    clearInterval(fetchRef.current)
    fetchRef.current = setInterval(() => fetchQuotes(active.positions), 15_000)
    return () => clearInterval(fetchRef.current)
  }, [active?.positions, fetchQuotes])

  const symbolsKey = (active?.positions ?? []).map((p) => p.symbol).sort().join(',')
  useEffect(() => {
    if (!symbolsKey) { setRatings({}); return }
    let cancelled = false
    async function loadRatings() {
      setRatingsLoading(true)
      try {
        const res = await fetch(
          apiUrl(`/api/analyst-ratings?symbols=${encodeURIComponent(symbolsKey)}`),
          { headers: authHeaders(token) },
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setRatings(res.ok ? (json.ratings ?? {}) : {})
      } catch {
        if (!cancelled) setRatings({})
      } finally {
        if (!cancelled) setRatingsLoading(false)
      }
    }
    loadRatings()
    return () => { cancelled = true }
  }, [symbolsKey, token])

  // ── Computed metrics ──────────────────────────────────────────────────────

  const rows = (active?.positions ?? []).map((p) => {
    const q = quotes[p.symbol]
    const price = q?.price ?? null
    const mktValue = price != null ? price * p.shares : null
    const gain = mktValue != null ? mktValue - p.costBasis : null
    const gainPct = gain != null && p.costBasis > 0 ? (gain / p.costBasis) * 100 : null
    const avgCost = p.shares > 0 ? p.costBasis / p.shares : null
    const dayPct = q?.changePercent ?? null
    const rating = ratings[p.symbol] ?? null
    const analystTarget = rating?.avgTarget ?? null
    const analystUpside = analystTarget != null && price != null && price > 0
      ? ((analystTarget - price) / price) * 100
      : null
    return { ...p, price, mktValue, gain, gainPct, avgCost, dayPct, rating, analystTarget, analystUpside }
  })

  const holdingsValue = rows.reduce((s, r) => s + (r.mktValue ?? r.costBasis), 0)
  const totalValue = holdingsValue + (active?.cash ?? 0)
  const totalReturn = totalValue - (active?.budget ?? 0)
  const totalReturnPct = active?.budget > 0 ? (totalReturn / active.budget) * 100 : null
  const cashPct = totalValue > 0 ? (active?.cash / totalValue) * 100 : 100

  const pieData = [
    ...rows.filter((r) => r.mktValue != null && totalValue > 0)
      .map((r) => ({ name: r.symbol, value: parseFloat(((r.mktValue / totalValue) * 100).toFixed(1)) })),
    ...(active?.cash > 0 && totalValue > 0
      ? [{ name: 'Cash', value: parseFloat((cashPct).toFixed(1)) }]
      : []),
  ]

  return (
    <div className="app-page-enter space-y-6">
      {/* Header + portfolio tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Portfolio</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Virtual trading — real market prices, simulated capital.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07]"
        >
          <Plus className="size-3.5" /> New portfolio
        </button>
      </div>

      {/* Portfolio switcher */}
      {store.portfolios.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {store.portfolios.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={['rounded-lg px-3 py-1.5 text-xs font-medium transition', p.id === active.id
                ? 'bg-accent-muted text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)]'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'].join(' ')}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total value', value: fmtCash(totalValue), sub: `${active?.name}` },
          { label: 'Cash available', value: fmtCash(active?.cash), sub: `${cashPct > 0 ? fmt(cashPct, 1) : 0}% of portfolio` },
          {
            label: 'Total return',
            value: fmtDollar(totalReturn),
            colored: true, num: totalReturn,
            sub: totalReturnPct != null ? `${totalReturnPct >= 0 ? '+' : ''}${fmt(totalReturnPct)}%` : null,
          },
          { label: 'Starting budget', value: fmtCash(active?.budget), sub: 'Virtual capital' },
        ].map((c) => (
          <div key={c.label} className="card-hover rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-[11px] text-zinc-500">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${
              c.colored
                ? c.num == null ? 'text-zinc-400' : c.num >= 0 ? 'text-emerald-400' : 'text-red-400'
                : 'text-zinc-100'
            }`}>
              {c.value}
            </p>
            {c.sub && <p className={`mt-0.5 text-[11px] tabular-nums ${c.colored && c.num != null ? c.num >= 0 ? 'text-emerald-500/70' : 'text-red-500/70' : 'text-zinc-600'}`}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Add position */}
      <AddPositionPanel cash={active?.cash ?? 0} token={token} onBuy={handleBuy} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Positions table */}
        <div className="dash-module-enter overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">Holdings</h2>
            <div className="flex items-center gap-2">
              {quotesLoading && <Loader2 className="size-3.5 animate-spin text-zinc-600" />}
              <button
                type="button"
                onClick={() => fetchQuotes(active?.positions ?? [])}
                className="rounded-lg p-1.5 text-zinc-600 transition hover:text-zinc-300"
                title="Refresh prices"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 pb-8 pt-2 text-center">
              <Wallet className="mx-auto mb-2 size-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">No positions yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Enter a symbol above, fetch its price, then buy shares or a dollar amount.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-zinc-500">
                    {['Symbol', 'Shares', 'Avg Cost', 'Price', 'Mkt Value', 'P&L', 'Return', 'Day %', 'Analyst Target', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-100">{r.symbol}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-300">{fmt(r.shares, r.shares % 1 === 0 ? 0 : 4)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-400">{r.avgCost != null ? `$${fmt(r.avgCost)}` : '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-200">{r.price != null ? `$${fmt(r.price)}` : <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-200">{r.mktValue != null ? `$${fmt(r.mktValue)}` : <span className="text-zinc-600">—</span>}</td>
                      <td className={`px-4 py-3 font-medium tabular-nums ${r.gain == null ? 'text-zinc-600' : r.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.gain != null ? fmtDollar(r.gain) : '—'}
                      </td>
                      <td className={`px-4 py-3 font-medium tabular-nums ${r.gainPct == null ? 'text-zinc-600' : r.gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.gainPct != null ? `${r.gainPct >= 0 ? '+' : ''}${fmt(r.gainPct)}%` : '—'}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${r.dayPct == null ? 'text-zinc-600' : r.dayPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.dayPct != null ? `${r.dayPct >= 0 ? '+' : ''}${fmt(r.dayPct)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {ratingsLoading && !r.rating ? (
                          <span className="inline-block h-4 w-16 animate-pulse rounded bg-white/5" />
                        ) : r.analystTarget != null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-200">${fmt(r.analystTarget)}</span>
                            {r.analystUpside != null ? (
                              <span className={`text-[11px] ${r.analystUpside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {r.analystUpside >= 0 ? '+' : ''}{fmt(r.analystUpside, 1)}%
                              </span>
                            ) : null}
                            {r.rating?.consensus?.code ? <ConsensusPill code={r.rating.consensus.code} /> : null}
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSell(r.symbol)}
                          title="Sell position (returns current market value to cash)"
                          className="rounded px-2 py-1 text-[10px] font-medium text-zinc-600 ring-1 ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-400 hover:ring-rose-500/20"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Portfolio actions */}
          <div className="border-t border-white/[0.06] px-5 py-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-500 transition hover:border-amber-500/30 hover:text-amber-400"
            >
              <RotateCcw className="size-3" /> Reset portfolio
            </button>
            {store.portfolios.length > 1 && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-500 transition hover:border-rose-500/30 hover:text-rose-400"
              >
                <Trash2 className="size-3" /> Delete portfolio
              </button>
            )}
          </div>
        </div>

        {/* Allocation pie */}
        <div className="dash-module-enter rounded-xl border border-white/[0.07] bg-white/[0.03] p-5" style={{ '--dash-stagger': 1 }}>
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Allocation</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className={`font-medium ${d.name === 'Cash' ? 'text-zinc-400' : 'font-mono text-zinc-300'}`}>{d.name}</span>
                    </div>
                    <span className="text-zinc-400">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <p className="text-xs text-zinc-600">Add positions to see allocation</p>
            </div>
          )}
        </div>
      </div>

      {/* Today's moves */}
      {rows.some((r) => r.dayPct != null) && (
        <div className="dash-module-enter rounded-xl border border-white/[0.07] bg-white/[0.03] p-5" style={{ '--dash-stagger': 2 }}>
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Today's moves</h2>
          <div className="flex flex-wrap gap-2">
            {[...rows].filter((r) => r.dayPct != null).sort((a, b) => b.dayPct - a.dayPct).map((r) => (
              <div key={r.symbol} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${r.dayPct >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-red-500/20 bg-red-500/[0.07]'}`}>
                {r.dayPct >= 0 ? <TrendingUp className="size-3.5 text-emerald-400" /> : <TrendingDown className="size-3.5 text-red-400" />}
                <span className="font-mono font-semibold text-zinc-100">{r.symbol}</span>
                <span className={r.dayPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>{r.dayPct >= 0 ? '+' : ''}{fmt(r.dayPct)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewModal && <NewPortfolioModal onClose={() => setShowNewModal(false)} onCreate={createPortfolio} />}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-zinc-100">Reset portfolio?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              All positions in <span className="font-semibold text-zinc-200">{active?.name}</span> will be cleared and cash will be restored to {fmtCash(active?.budget)}.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={resetPortfolio} className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110">Reset</button>
              <button onClick={() => setShowResetConfirm(false)} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 transition hover:border-white/15">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-zinc-100">Delete portfolio?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">{active?.name}</span> will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={deletePortfolio} className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white transition hover:brightness-110">Delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 transition hover:border-white/15">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
