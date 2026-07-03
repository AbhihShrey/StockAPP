import {
  AlertTriangle,
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
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ConsensusPill } from '../components/AnalystCoveragePanel'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE_KEY = 'ember_portfolios_v3'

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

// Chart config — the one allowed place for hex (warm allocation ramp).
const PIE_COLORS = ['#FF6B2C', '#FFA53D', '#C2410C', '#3DDC97', '#B5AB9F', '#837A6F']

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
    <div className="glass rounded-lg border border-line-strong px-3 py-2 text-xs shadow-xl shadow-black/40">
      <p className="num font-semibold text-ink">{d.name}</p>
      <p className="num mt-0.5 text-ink-2">{fmt(d.value, 1)}% of portfolio</p>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="glass w-[360px] max-w-full rounded-[14px] border border-line-strong p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">New portfolio</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-3 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="new-portfolio-name" className="field-label">Portfolio name</label>
            <input
              id="new-portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tech focused, Long-term"
              autoFocus
              className="input"
            />
          </div>
          <div>
            <label htmlFor="new-portfolio-budget" className="field-label">Starting budget ($)</label>
            <input
              id="new-portfolio-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="100000"
              className="input num"
            />
            <p className="mt-1.5 text-[11px] text-ink-3">
              This is the total virtual cash you start with. You can only spend what you have.
            </p>
          </div>
          {error && <p className="text-xs text-down">{error}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="submit" className="btn-primary flex-1">Create portfolio</button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
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
    <section className="panel panel-hover panel-pad">
      <h2 className="eyebrow mb-4">Add position</h2>
      <div className="flex flex-wrap items-end gap-3">
        {/* Symbol */}
        <div className="flex flex-col">
          <label htmlFor="add-position-symbol" className="field-label">Symbol</label>
          <div className="relative">
            <input
              id="add-position-symbol"
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setFetchedPrice(null); setBusySymbol('') }}
              onBlur={handleSymbolBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleSymbolBlur()}
              placeholder="AAPL"
              maxLength={12}
              className="input num w-28"
            />
            {fetching && (
              <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-ink-3" aria-hidden />
            )}
          </div>
        </div>

        {/* Price display */}
        <div className="flex flex-col">
          <span className="field-label">Live price</span>
          <div className="num flex h-9 w-28 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm">
            {fetchedPrice != null
              ? <span className="text-ink">${fmt(fetchedPrice)}</span>
              : <span className="text-ink-3">{fetching ? '…' : 'Enter symbol'}</span>}
          </div>
        </div>

        {/* Mode toggle + amount */}
        <div className="flex flex-col gap-1.5">
          <div
            className="inline-flex items-center gap-1 self-start rounded-lg border border-line bg-surface-2 p-0.5"
            role="group"
            aria-label="Amount input mode"
          >
            {[['dollars', '$ amount'], ['shares', 'Shares']].map(([m, l]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setInputMode(m); setAmount('') }}
                aria-pressed={inputMode === m}
                className={[
                  'rounded-md px-2.5 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
                  inputMode === m ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
                ].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>
          <label htmlFor="add-position-amount" className="sr-only">
            {inputMode === 'dollars' ? 'Dollar amount' : 'Number of shares'}
          </label>
          <input
            id="add-position-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canBuy && handleBuy()}
            placeholder={inputMode === 'dollars' ? 'e.g. 5000' : 'e.g. 10'}
            className="input num w-36"
          />
        </div>

        {/* Buy summary + button */}
        <div className="flex flex-col">
          <span className="field-label">Order summary</span>
          <div className="flex items-center gap-2">
            <div className="num flex h-9 items-center rounded-lg border border-line bg-surface-2 px-3 text-xs whitespace-nowrap text-ink-2">
              {cost != null && shares != null ? (
                <>{fmt(shares, 4)} sh · {fmtDollar(cost, false)}</>
              ) : <span className="text-ink-3">—</span>}
            </div>
            <button type="button" onClick={handleBuy} disabled={!canBuy} className="btn-primary">
              Buy
            </button>
          </div>
        </div>
      </div>
      {fetchError && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-down">
          <AlertTriangle className="size-3.5" aria-hidden />{fetchError}
        </p>
      )}
      {cost != null && cost > cash && (
        <p className="num mt-2 text-xs text-down">Insufficient funds — you need {fmtDollar(cost - cash, false)} more.</p>
      )}
    </section>
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

  const gaining = totalReturn >= 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="rise">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Portfolio · Paper trading</p>
            <h1 className="display mt-1 text-2xl sm:text-3xl">Portfolio</h1>
            <p className="mt-1.5 text-sm text-ink-3">Virtual trading — real market prices, simulated capital.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="btn-ghost shrink-0 self-start sm:self-auto"
          >
            <Plus className="size-4" aria-hidden /> New portfolio
          </button>
        </div>
        <div className="ember-rule mt-4" aria-hidden />
      </header>

      {/* Portfolio switcher */}
      {store.portfolios.length > 1 && (
        <div className="rise rise-1 flex flex-wrap gap-1.5" role="group" aria-label="Portfolios">
          {store.portfolios.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              aria-pressed={p.id === active.id}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
                p.id === active.id
                  ? 'border-ember/30 bg-ember/10 text-flame'
                  : 'border-line bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink',
              ].join(' ')}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* KPI heroes */}
      <section className="rise rise-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel panel-hover panel-pad">
          <p className="eyebrow">Total value</p>
          <p className="display num mt-2 text-2xl text-ink sm:text-3xl">
            <AnimatedNumber value={totalValue} format={(v) => fmtCash(v)} />
          </p>
          <p className="mt-1 truncate text-xs text-ink-3">{active?.name}</p>
        </div>
        <div className="panel panel-hover panel-pad">
          <p className="eyebrow">Cash available</p>
          <p className="display num mt-2 text-2xl text-ink sm:text-3xl">
            <AnimatedNumber value={active?.cash} format={(v) => fmtCash(v)} />
          </p>
          <p className="num mt-1 text-xs text-ink-3">{cashPct > 0 ? fmt(cashPct, 1) : 0}% of portfolio</p>
        </div>
        <div className="panel panel-hover panel-pad">
          <p className="eyebrow">Total return</p>
          <p
            className={[
              'display num mt-2 flex items-center gap-1.5 text-2xl sm:text-3xl',
              gaining ? 'text-up' : 'text-down',
            ].join(' ')}
          >
            {gaining
              ? <TrendingUp className="size-5 shrink-0" aria-hidden />
              : <TrendingDown className="size-5 shrink-0" aria-hidden />}
            <AnimatedNumber value={totalReturn} format={(v) => fmtDollar(v)} />
          </p>
          {totalReturnPct != null && (
            <p className={['num mt-1 text-xs', gaining ? 'text-up/70' : 'text-down/70'].join(' ')}>
              {totalReturnPct >= 0 ? '▲' : '▼'} {totalReturnPct >= 0 ? '+' : ''}{fmt(totalReturnPct)}%
            </p>
          )}
        </div>
        <div className="panel panel-hover panel-pad">
          <p className="eyebrow">Starting budget</p>
          <p className="display num mt-2 text-2xl text-ink sm:text-3xl">{fmtCash(active?.budget)}</p>
          <p className="mt-1 text-xs text-ink-3">Virtual capital</p>
        </div>
      </section>

      {/* Add position */}
      <div className="rise rise-3">
        <AddPositionPanel cash={active?.cash ?? 0} token={token} onBuy={handleBuy} />
      </div>

      <div className="rise rise-4 grid gap-4 lg:grid-cols-3">
        {/* Holdings table */}
        <section className="panel overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <h2 className="eyebrow">Holdings</h2>
            <div className="flex items-center gap-2">
              {quotesLoading && <Loader2 className="size-3.5 animate-spin text-ink-3" aria-hidden />}
              <button
                type="button"
                onClick={() => fetchQuotes(active?.positions ?? [])}
                className="rounded-lg p-2 text-ink-3 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
                aria-label="Refresh prices"
                title="Refresh prices"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <Wallet className="size-8 text-ink-3" aria-hidden />
              <p className="text-sm text-ink-2">No positions yet.</p>
              <p className="max-w-xs text-xs text-ink-3">
                Enter a symbol above, fetch its price, then buy shares or a dollar amount.
              </p>
            </div>
          ) : (
            <div className="tbl rounded-none border-0 bg-transparent">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Shares</th>
                    <th className="num">Avg cost</th>
                    <th className="num">Price</th>
                    <th className="num">Mkt value</th>
                    <th className="num">P&amp;L</th>
                    <th className="num">Return</th>
                    <th className="num">Day %</th>
                    <th>Analyst target</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol}>
                      <td className="num font-semibold text-ink">{r.symbol}</td>
                      <td className="num">{fmt(r.shares, r.shares % 1 === 0 ? 0 : 4)}</td>
                      <td className="num text-ink-3">{r.avgCost != null ? `$${fmt(r.avgCost)}` : '—'}</td>
                      <td className="num text-ink">
                        {r.price != null ? `$${fmt(r.price)}` : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="num text-ink">
                        {r.mktValue != null ? `$${fmt(r.mktValue)}` : <span className="text-ink-3">—</span>}
                      </td>
                      <td className={['num font-medium', r.gain == null ? 'text-ink-3' : r.gain >= 0 ? 'text-up' : 'text-down'].join(' ')}>
                        {r.gain != null ? (
                          <><span aria-hidden className="text-[9px]">{r.gain >= 0 ? '▲' : '▼'}</span> {fmtDollar(r.gain)}</>
                        ) : '—'}
                      </td>
                      <td className={['num font-medium', r.gainPct == null ? 'text-ink-3' : r.gainPct >= 0 ? 'text-up' : 'text-down'].join(' ')}>
                        {r.gainPct != null ? `${r.gainPct >= 0 ? '+' : ''}${fmt(r.gainPct)}%` : '—'}
                      </td>
                      <td className={['num', r.dayPct == null ? 'text-ink-3' : r.dayPct >= 0 ? 'text-up' : 'text-down'].join(' ')}>
                        {r.dayPct != null ? `${r.dayPct >= 0 ? '+' : ''}${fmt(r.dayPct)}%` : '—'}
                      </td>
                      <td>
                        {ratingsLoading && !r.rating ? (
                          <span className="skeleton inline-block h-4 w-16" aria-hidden />
                        ) : r.analystTarget != null ? (
                          <div className="flex items-center gap-2">
                            <span className="num text-ink">${fmt(r.analystTarget)}</span>
                            {r.analystUpside != null ? (
                              <span className={['num text-[11px]', r.analystUpside >= 0 ? 'text-up' : 'text-down'].join(' ')}>
                                {r.analystUpside >= 0 ? '+' : ''}{fmt(r.analystUpside, 1)}%
                              </span>
                            ) : null}
                            {r.rating?.consensus?.code ? <ConsensusPill code={r.rating.consensus.code} /> : null}
                          </div>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleSell(r.symbol)}
                          title="Sell position (returns current market value to cash)"
                          className="rounded-md border border-down/25 bg-down/10 px-2.5 py-1 text-[11px] font-medium text-down outline-none transition-colors hover:bg-down/20 focus-visible:ring-2 focus-visible:ring-ember/60"
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
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="btn-ghost h-8 px-3 text-xs hover:text-warn"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Reset portfolio
            </button>
            {store.portfolios.length > 1 && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-ghost h-8 px-3 text-xs hover:text-down"
              >
                <Trash2 className="size-3.5" aria-hidden /> Delete portfolio
              </button>
            )}
          </div>
        </section>

        {/* Allocation pie */}
        <section className="panel panel-hover panel-pad">
          <h2 className="eyebrow mb-4">Allocation</h2>
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
              <div className="mt-3 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        aria-hidden
                      />
                      <span className={d.name === 'Cash' ? 'font-medium text-ink-2' : 'num font-medium text-ink'}>
                        {d.name}
                      </span>
                    </div>
                    <span className="num text-ink-2">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <p className="text-xs text-ink-3">Add positions to see allocation</p>
            </div>
          )}
        </section>
      </div>

      {/* Today's moves */}
      {rows.some((r) => r.dayPct != null) && (
        <section className="rise rise-5 panel panel-pad">
          <h2 className="eyebrow mb-3">Today's moves</h2>
          <div className="flex flex-wrap gap-2">
            {[...rows].filter((r) => r.dayPct != null).sort((a, b) => b.dayPct - a.dayPct).map((r) => (
              <div
                key={r.symbol}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                  r.dayPct >= 0 ? 'border-up/25 bg-up/10' : 'border-down/25 bg-down/10',
                ].join(' ')}
              >
                {r.dayPct >= 0
                  ? <TrendingUp className="size-3.5 text-up" aria-hidden />
                  : <TrendingDown className="size-3.5 text-down" aria-hidden />}
                <span className="num font-semibold text-ink">{r.symbol}</span>
                <span className={['num', r.dayPct >= 0 ? 'text-up' : 'text-down'].join(' ')}>
                  {r.dayPct >= 0 ? '+' : ''}{fmt(r.dayPct)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {showNewModal && <NewPortfolioModal onClose={() => setShowNewModal(false)} onCreate={createPortfolio} />}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass w-80 max-w-full rounded-[14px] border border-line-strong p-6 shadow-2xl shadow-black/50">
            <h2 className="font-display text-base font-semibold text-ink">Reset portfolio?</h2>
            <p className="mt-2 text-sm text-ink-2">
              All positions in <span className="font-semibold text-ink">{active?.name}</span> will be cleared and cash
              will be restored to <span className="num">{fmtCash(active?.budget)}</span>.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={resetPortfolio}
                className="btn flex-1 border border-warn/30 bg-warn/10 font-semibold text-warn hover:bg-warn/20"
              >
                Reset portfolio
              </button>
              <button type="button" onClick={() => setShowResetConfirm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass w-80 max-w-full rounded-[14px] border border-line-strong p-6 shadow-2xl shadow-black/50">
            <h2 className="font-display text-base font-semibold text-ink">Delete portfolio?</h2>
            <p className="mt-2 text-sm text-ink-2">
              <span className="font-semibold text-ink">{active?.name}</span> will be permanently deleted. This cannot
              be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={deletePortfolio} className="btn-danger flex-1">Delete portfolio</button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
