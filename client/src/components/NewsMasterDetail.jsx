import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MiniSparkline } from './MiniSparkline'
import { apiUrl } from '../lib/apiBase'

const QUICK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'AMD', 'NFLX', 'SPY', 'QQQ', 'COIN']

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'ma', label: 'M&A' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function timeAgo(published) {
  if (!published) return '—'
  const t = new Date(String(published).replace(' ', 'T'))
  if (Number.isNaN(t.getTime())) return '—'
  const sec = Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000))
  if (sec < 60) return 'Just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`
  return published.slice(0, 10)
}

function formatVol(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

function formatPrice(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toFixed(4)
}

function articleDay(published) {
  const s = String(published ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/** Drop items outside the selected calendar window (API can leak edge rows). */
function articleInDateRange(a, from, to) {
  const d = articleDay(a.publishedDate)
  if (!d) return true
  return d >= from && d <= to
}

/** Sentiment in roughly [-1, 1]; `source` tells whether it came from FMP or a local estimate. */
function SentimentMeter({ sentiment, sentimentSource, compact }) {
  if (sentiment == null || !Number.isFinite(sentiment)) {
    return (
      <div className={compact ? 'text-[10px] text-ink-3' : 'text-xs text-ink-3'}>No sentiment score</div>
    )
  }
  const pos = Math.round(((sentiment + 1) / 2) * 100)
  const label =
    sentiment > 0.12 ? 'Positive' : sentiment < -0.12 ? 'Negative' : 'Neutral'
  const tip =
    sentimentSource === 'lexicon'
      ? `Estimated from headline and summary (FMP did not attach a score). Raw tilt ${sentiment.toFixed(2)}.`
      : sentimentSource === 'fmp'
        ? `Provider sentiment. Raw ${sentiment.toFixed(2)}.`
        : `Tilt ${pos}% toward bullish (raw ${sentiment.toFixed(2)})`
  const fill = sentiment > 0.12 ? 'bg-up' : sentiment < -0.12 ? 'bg-down' : 'bg-ink-3'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Sentiment
          {sentimentSource === 'lexicon' ? (
            <span className="ml-1 font-normal normal-case tracking-normal">(est.)</span>
          ) : null}
        </span>
        <span className="num text-[10px] font-semibold text-ink-2">
          {pos}% <span className="text-ink-3">{label}</span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ring-1 ring-line"
        title={tip}
      >
        <div className={['h-full rounded-full', fill].join(' ')} style={{ width: `${pos}%` }} />
      </div>
    </div>
  )
}

function SentimentBadge({ sentiment, sentimentSource }) {
  const estTitle =
    sentimentSource === 'lexicon'
      ? 'Estimated from headline and summary — FMP feed did not include a model score for this item.'
      : undefined
  if (sentiment == null || !Number.isFinite(sentiment)) {
    return (
      <span
        className="chip uppercase tracking-wide"
        title="No usable sentiment from the feed and nothing to infer from text."
      >
        N/A
      </span>
    )
  }
  if (sentiment > 0.12) {
    return (
      <span className="chip chip-up uppercase tracking-wide" title={estTitle}>
        Pos
      </span>
    )
  }
  if (sentiment < -0.12) {
    return (
      <span className="chip chip-down uppercase tracking-wide" title={estTitle}>
        Neg
      </span>
    )
  }
  return (
    <span className="chip uppercase tracking-wide" title={estTitle}>
      Neu
    </span>
  )
}

export function NewsMasterDetail() {
  const [to, setTo] = useState(todayISO)
  const [from, setFrom] = useState(() => addDays(todayISO(), -30))
  const [category, setCategory] = useState('all')
  const [symbolDraft, setSymbolDraft] = useState('')
  const [symbolFilter, setSymbolFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [articles, setArticles] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [snapLoading, setSnapLoading] = useState(false)

  const filterKey = useMemo(
    () => [category, from, to, pageSize, symbolFilter].join('|'),
    [category, from, to, pageSize, symbolFilter],
  )

  const selected = useMemo(
    () => articles.find((a) => a.id === selectedId) ?? articles[0] ?? null,
    [articles, selectedId],
  )

  const fetchFeedPage = useCallback(
    async (pageIndex) => {
      const params = new URLSearchParams({
        category,
        from,
        to,
        limit: String(pageSize),
        page: String(pageIndex),
      })
      const sym = symbolFilter.trim().toUpperCase()
      if (sym) params.set('symbol', sym)
      const res = await fetch(apiUrl(`/api/stock-news?${params}`))
      const json = await res.json().catch(() => null)
      return { res, json }
    },
    [category, from, to, pageSize, symbolFilter],
  )

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const { res, json } = await fetchFeedPage(page)
        if (cancelled) return
        if (!res.ok) {
          setError(json?.message ?? 'Failed to load news')
          setArticles([])
          setMeta(null)
          return
        }
        const rawList = Array.isArray(json?.articles) ? json.articles : []
        const list = rawList.filter((a) => articleInDateRange(a, from, to))
        setArticles(list)
        setMeta(json)
        setSelectedId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev
          return list[0]?.id ?? null
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Network error')
          setArticles([])
          setMeta(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [filterKey, page, fetchFeedPage, from, to])

  const canNext = !loading && !error && articles.length >= pageSize
  const canPrev = page > 0 && !loading

  useEffect(() => {
    const sym = symbolFilter.trim().toUpperCase()
    if (!sym) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    setSnapLoading(true)
    fetch(apiUrl(`/api/stock-news/snapshot?symbol=${encodeURIComponent(sym)}`))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setSnapshot(j?.symbol ? j : null)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
      .finally(() => {
        if (!cancelled) setSnapLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbolFilter])

  function applySymbol() {
    const s = symbolDraft.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
    setSymbolDraft(s)
    setSymbolFilter(s)
    setPage(0)
  }

  function clearSymbol() {
    setSymbolDraft('')
    setSymbolFilter('')
    setPage(0)
  }

  const related = useMemo(() => {
    if (!selected?.tickers?.length) return []
    const cur = symbolFilter.trim().toUpperCase()
    return selected.tickers.filter((t) => t !== cur)
  }, [selected, symbolFilter])

  return (
    <section className="space-y-4">
      <div className="rise rise-3 panel panel-pad space-y-4">
        <div className="space-y-2">
          <label className="field-label" htmlFor="news-symbol-input">
            Symbol focus
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Quick symbol"
              value={QUICK_SYMBOLS.includes(symbolFilter) ? symbolFilter : ''}
              onChange={(e) => {
                const v = e.target.value.toUpperCase()
                setSymbolDraft(v)
                setSymbolFilter(v)
                setPage(0)
              }}
              className="select num w-44 text-xs font-semibold"
            >
              <option value="">Quick symbol…</option>
              {QUICK_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              id="news-symbol-input"
              list="news-quick-symbols"
              value={symbolDraft}
              onChange={(e) => setSymbolDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySymbol()}
              placeholder="Or type ticker…"
              className="input min-w-[10rem] flex-1"
            />
            <datalist id="news-quick-symbols">
              {QUICK_SYMBOLS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button type="button" onClick={applySymbol} className="btn-primary px-4 text-xs">
              Load
            </button>
            {symbolFilter ? (
              <button type="button" onClick={clearSymbol} className="btn-ghost px-3 text-xs">
                Clear
              </button>
            ) : null}
          </div>
          <p className="max-w-2xl text-[11px] leading-relaxed text-ink-3">
            Type or pick a symbol, then Load for headlines on that name (past & present in range). Leave empty for
            the broad market feed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id)
                setPage(0)
              }}
              aria-pressed={category === c.id}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                category === c.id
                  ? 'border-ember/30 bg-ember/10 text-flame'
                  : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
              ].join(' ')}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label" htmlFor="news-from-date">From</label>
            <input
              id="news-from-date"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value || addDays(to, -30))
                setPage(0)
              }}
              className="input num w-40"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="news-to-date">To</label>
            <input
              id="news-to-date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value || todayISO())
                setPage(0)
              }}
              className="input num w-40"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="news-page-size">Per page</label>
            <select
              id="news-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 50)
                setPage(0)
              }}
              className="select num w-24"
              aria-label="Page size"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rise rise-4 flex min-h-[28rem] flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="panel flex min-h-0 w-full flex-col overflow-hidden lg:w-[40%] lg:max-w-[40%]">
          <div className="border-b border-line px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Headlines</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[10px] font-semibold text-ink-3">{articles.length} loaded</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={!canPrev}
                    className="btn-ghost h-7 w-7 px-0"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                  </button>
                  <span className="num min-w-[4.5rem] text-center text-[10px] font-semibold text-ink-3">
                    Page {page + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!canNext}
                    className="btn-ghost h-7 w-7 px-0"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-3">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading feed…
              </div>
            ) : error ? (
              <p className="px-2 py-8 text-center text-sm text-down">{error}</p>
            ) : articles.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-ink-3">
                {symbolFilter
                  ? `No news found for ${symbolFilter} in this range. Try another page or widen dates, or clear the symbol for the market feed.`
                  : 'No articles matched these filters.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {articles.map((a) => {
                  const active = selected?.id === a.id
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        aria-current={active || undefined}
                        className={[
                          'relative w-full rounded-lg py-2.5 pl-4 pr-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                          active ? 'bg-ember/5' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'bg-ember-grad absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-opacity duration-200',
                            active ? 'opacity-100' : 'opacity-0',
                          ].join(' ')}
                          aria-hidden
                        />
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{a.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="num text-[10px] font-medium uppercase tracking-wide text-ink-3">
                            {a.site}
                          </span>
                          <span className="num text-[10px] text-ink-3">{timeAgo(a.publishedDate)}</span>
                          <SentimentBadge sentiment={a.sentiment} sentimentSource={a.sentimentSource} />
                        </div>
                        <div className="mt-2">
                          <SentimentMeter sentiment={a.sentiment} sentimentSource={a.sentimentSource} compact />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {!loading && !error && articles.length > 0 ? (
              <p className="px-2 pb-1 pt-3 text-center text-[10px] text-ink-3">
                {canNext ? 'More articles available — use next page.' : 'Last page for this date window (or feed).'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-line px-4 py-2">
            <p className="eyebrow">Story & context</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {!selected ? (
              <p className="py-12 text-center text-sm text-ink-3">Select an article to read the summary.</p>
            ) : (
              <div className="max-w-prose space-y-4">
                {symbolFilter ? (
                  <div className="rounded-xl border border-line bg-surface-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">Filtered symbol</p>
                        <p className="num mt-1 text-lg font-semibold text-ink">{symbolFilter}</p>
                      </div>
                      {snapLoading ? (
                        <Loader2 className="size-5 animate-spin text-ink-3" aria-label="Loading quote" />
                      ) : snapshot?.price != null ? (
                        <MiniSparkline values={snapshot.sparkline ?? []} className="opacity-90" />
                      ) : null}
                    </div>
                    {snapshot?.price != null ? (
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-3">Price</dt>
                          <dd className="num font-semibold text-ink">{formatPrice(snapshot.price)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-3">Change</dt>
                          <dd
                            className={[
                              'num font-semibold',
                              (snapshot.changePercent ?? 0) > 0
                                ? 'text-up'
                                : (snapshot.changePercent ?? 0) < 0
                                  ? 'text-down'
                                  : 'text-ink-2',
                            ].join(' ')}
                          >
                            {snapshot.changePercent != null && Number.isFinite(snapshot.changePercent)
                              ? `${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-3">Volume</dt>
                          <dd className="num font-medium text-ink-2">{formatVol(snapshot.volume)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-3">Avg vol</dt>
                          <dd className="num font-medium text-ink-3">{formatVol(snapshot.avgVolume)}</dd>
                        </div>
                      </dl>
                    ) : !snapLoading ? (
                      <p className="mt-2 text-xs text-ink-3">Live quote data unavailable for this symbol.</p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <h2 className="font-display text-xl font-semibold leading-snug text-ink" style={{ fontStretch: '106%' }}>
                    {selected.title}
                  </h2>
                  <p className="num mt-1.5 text-xs text-ink-3">
                    {selected.site} · {timeAgo(selected.publishedDate)}
                    {selected.publishedDate ? ` · ${selected.publishedDate}` : ''}
                  </p>
                </div>

                <SentimentMeter sentiment={selected.sentiment} sentimentSource={selected.sentimentSource} />

                {selected.image ? (
                  <img
                    src={selected.image}
                    alt=""
                    className="max-h-48 w-full rounded-lg border border-line object-cover object-center"
                  />
                ) : null}

                <p className="whitespace-pre-wrap text-base leading-[1.6] text-ink-2">
                  {selected.text || 'No summary text was provided for this item.'}
                </p>

                {selected.url ? (
                  <a href={selected.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                    Open source article
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}

                {related.length > 0 ? (
                  <div className="border-t border-line pt-4">
                    <p className="eyebrow">Related symbols</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {related.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setSymbolDraft(t)
                            setSymbolFilter(t)
                            setPage(0)
                          }}
                          className="chip num cursor-pointer px-3 py-1 text-xs font-semibold outline-none transition-colors duration-150 hover:border-ember/40 hover:bg-ember/10 hover:text-flame focus-visible:ring-2 focus-visible:ring-ember/60"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {meta?.source ? (
        <p className="text-center text-[10px] text-ink-3">Market data: {meta.source}</p>
      ) : null}
    </section>
  )
}
