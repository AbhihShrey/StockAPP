import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardCard } from '../components/DashboardCard'
import { LightweightSpyChart } from '../components/LightweightSpyChart'
import { MarketInternalsPanel } from '../components/MarketInternalsPanel'
import { TableShell } from '../components/TableShell'
import { MarketHeatmap } from '../components/markets/MarketHeatmap'
import { MiniTerminalCard } from '../components/markets/MiniTerminalCard'
import { MarketsSentimentStrip } from '../components/markets/MarketsSentimentStrip'
import { formatPct, formatVolRatio, ScannerTopFiveTable } from '../components/markets/ScannerTopFiveTable'
import { apiUrl } from '../lib/apiBase'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'scanners', label: 'Scanners & flow' },
]

/** Delta rendered per the data-color rules: up/down tint always paired with ▲▼. */
function DeltaPct({ value }) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null
  const tone = n == null || n === 0 ? 'text-ink-3' : n > 0 ? 'text-up' : 'text-down'
  return (
    <span className={`num inline-flex items-center justify-end gap-1 ${tone}`}>
      {n != null && n !== 0 ? <span aria-hidden>{n > 0 ? '▲' : '▼'}</span> : null}
      {formatPct(value)}
    </span>
  )
}

export function Markets() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assets, setAssets] = useState(null)
  const [internals, setInternals] = useState(null)
  const [internalsError, setInternalsError] = useState(null)
  const [breadth200, setBreadth200] = useState(null)
  const [breadth200Error, setBreadth200Error] = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [sentimentError, setSentimentError] = useState(null)
  const [scanners, setScanners] = useState(null)
  const [pollMs, setPollMs] = useState(30_000)
  const [tab, setTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState('SPY')

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
      setError(null)
      setInternalsError(null)
      setBreadth200Error(null)
      setSentimentError(null)
    }
    try {
      const [moversRes, assetsRes, internalsRes, breadthRes, sentRes, scanRes] = await Promise.all([
        fetch(apiUrl('/api/market-movers')),
        fetch(apiUrl('/api/global-assets')),
        fetch(apiUrl('/api/market-internals')),
        fetch(apiUrl('/api/market-breadth')),
        fetch(apiUrl('/api/market-sentiment')),
        fetch(apiUrl('/api/market-scanners')),
      ])

      const movers = await moversRes.json().catch(() => null)
      if (!moversRes.ok) throw new Error(movers?.message ?? 'Failed to load market movers')
      const ri = Number(movers?.refreshIntervalMs)
      if (Number.isFinite(ri) && ri >= 15_000) setPollMs(ri)

      const global = await assetsRes.json().catch(() => null)
      if (assetsRes.ok) setAssets(global)

      const intJson = await internalsRes.json().catch(() => null)
      if (internalsRes.ok) setInternals(intJson)
      else if (!silent) setInternalsError(intJson?.message ?? 'Failed to load internals')

      const bJson = await breadthRes.json().catch(() => null)
      if (breadthRes.ok) setBreadth200(bJson)
      else if (!silent) setBreadth200Error(bJson?.message ?? 'Failed to load breadth')

      const sJson = await sentRes.json().catch(() => null)
      if (sentRes.ok) setSentiment(sJson)
      else if (!silent) setSentimentError(sJson?.message ?? 'Sentiment unavailable')

      const scJson = await scanRes.json().catch(() => null)
      if (scanRes.ok) setScanners(scJson)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  const groups = assets?.groups
  const mergedBreadth = internals ? { ...internals, pctAbove200dma: breadth200?.pctAbove200dma } : internals
  const globalReady = Boolean(groups && typeof groups === 'object')
  const anyGlobal = ((groups?.indices?.length ?? 0) + (groups?.yields?.length ?? 0) + (groups?.commodities?.length ?? 0) + (groups?.currencies?.length ?? 0)) > 0

  const skeletonCards = (count) =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton h-[5.5rem] rounded-xl" />
    ))

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Markets · Live macro &amp; flow</p>
        <h1 className="display text-2xl sm:text-3xl">Markets</h1>
        <div className="ember-rule mt-4" />
      </header>

      {loading ? (
        <div className="rise rise-2 space-y-4" aria-busy aria-label="Loading markets">
          <div className="panel panel-pad">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{skeletonCards(8)}</div>
          </div>
          <div className="skeleton h-72 rounded-[14px]" />
        </div>
      ) : error ? (
        <div className="rise rise-2 rounded-[14px] border border-down/25 bg-down/5 p-6 text-sm">
          <p className="font-medium text-down">Couldn’t load markets</p>
          <p className="mt-1 text-ink-2">{error}</p>
          <button type="button" className="btn-ghost mt-4" onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* 1. Global macro — mini terminals */}
          <section className="rise rise-2">
            <DashboardCard title="Global macro">
              {!globalReady ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{skeletonCards(8)}</div>
              ) : !anyGlobal ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4">
                  <p className="text-sm text-ink-3">Market data loading…</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <section>
                    <h3 className="eyebrow">Indices</h3>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {(groups?.indices ?? []).map((a, i) => (
                        <MiniTerminalCard key={a.symbol} asset={a} staggerMs={120 + i * 40} />
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="eyebrow">Yield curve</h3>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(groups?.yields ?? []).map((a, i) => (
                        <MiniTerminalCard key={a.symbol} asset={a} staggerMs={320 + i * 40} />
                      ))}
                    </div>
                  </section>
                  <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="eyebrow">Commodities &amp; risk</h3>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(groups?.commodities ?? []).map((a, i) => (
                          <MiniTerminalCard key={a.symbol} asset={a} staggerMs={520 + i * 40} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="eyebrow">Currencies</h3>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(groups?.currencies ?? []).map((a, i) => (
                          <MiniTerminalCard key={a.symbol} asset={a} staggerMs={680 + i * 40} />
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </DashboardCard>
          </section>

          <div className="rise rise-3 flex flex-wrap gap-1.5 rounded-[14px] border border-line bg-surface-1 p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={[
                  'rounded-lg px-4 py-2 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                  tab === t.id
                    ? 'bg-ember/10 text-flame'
                    : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="rise rise-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                <div className="space-y-4 lg:col-span-7">
                  <DashboardCard
                    title={chartSymbol}
                    action={
                      <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5">
                        {['SPY', 'QQQ'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setChartSymbol(s)}
                            aria-pressed={chartSymbol === s}
                            className={[
                              'num rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                              chartSymbol === s
                                ? 'bg-surface-3 text-flame'
                                : 'text-ink-3 hover:text-ink-2',
                            ].join(' ')}
                          >
                            {s}
                          </button>
                        ))}
                        <span className="num px-2 text-[11px] text-ink-3">1y · daily</span>
                      </div>
                    }
                  >
                    <LightweightSpyChart symbol={chartSymbol} />
                  </DashboardCard>
                  <DashboardCard title="Sentiment & fear">
                    <MarketsSentimentStrip
                      data={sentiment}
                      loading={!sentiment && !sentimentError}
                      error={sentimentError}
                    />
                  </DashboardCard>
                </div>
                <div className="flex flex-col gap-4 lg:col-span-5">
                  <DashboardCard title="Breadth & participation">
                    <MarketInternalsPanel
                      breadth={mergedBreadth}
                      breadthLoading={!mergedBreadth && !(internalsError || breadth200Error)}
                      breadthError={internalsError || breadth200Error}
                      highs={mergedBreadth?.highsProxy}
                      lows={mergedBreadth?.lowsProxy}
                    />
                  </DashboardCard>
                </div>
              </div>

              <DashboardCard title="Market heatmap">
                <MarketHeatmap />
              </DashboardCard>
            </div>
          )}

          {tab === 'scanners' && (
            <div className="rise rise-4 space-y-4">
              <TableShell title="Live scanners">
                <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-2">
                  <ScannerTopFiveTable
                    title="Volume rockets"
                    subtitle="Relative volume (today / avg)"
                    rows={scanners?.volumeRockets}
                    navigate={navigate}
                    columns={[
                      { key: 'ticker', label: 'Symbol' },
                      {
                        key: 'vol',
                        label: 'Rel. vol',
                        right: true,
                        render: (r) => (
                          <span
                            className={[
                              'num inline-flex items-center gap-2',
                              r?.meetsThreshold ? 'text-ink' : 'text-ink-2',
                            ].join(' ')}
                          >
                            {formatVolRatio(r.volumeRatio)}
                            {r?.meetsThreshold ? (
                              <span className="chip chip-ember">Rocket</span>
                            ) : (
                              <span className="chip">Top</span>
                            )}
                          </span>
                        ),
                      },
                      {
                        key: 'chg',
                        label: 'Chg%',
                        right: true,
                        render: (r) => <DeltaPct value={r.changePercent} />,
                      },
                    ]}
                  />
                  <ScannerTopFiveTable
                    title="Gap up"
                    subtitle="Open vs prior close"
                    rows={scanners?.gapUp}
                    navigate={navigate}
                    columns={[
                      { key: 'ticker', label: 'Symbol' },
                      {
                        key: 'gap',
                        label: 'Gap %',
                        right: true,
                        render: (r) => <DeltaPct value={r.gapPercent} />,
                      },
                      {
                        key: 'chg',
                        label: 'Day %',
                        right: true,
                        render: (r) => <DeltaPct value={r.changePercent} />,
                      },
                    ]}
                  />
                  <ScannerTopFiveTable
                    title="Gap down"
                    subtitle="Open vs prior close"
                    rows={scanners?.gapDown}
                    navigate={navigate}
                    columns={[
                      { key: 'ticker', label: 'Symbol' },
                      {
                        key: 'gap',
                        label: 'Gap %',
                        right: true,
                        render: (r) => <DeltaPct value={r.gapPercent} />,
                      },
                      {
                        key: 'chg',
                        label: 'Day %',
                        right: true,
                        render: (r) => <DeltaPct value={r.changePercent} />,
                      },
                    ]}
                  />
                  <ScannerTopFiveTable
                    title="VWAP stretch"
                    subtitle="Intraday session VWAP vs last (5m bars)"
                    rows={scanners?.vwapDeviations}
                    navigate={navigate}
                    columns={[
                      { key: 'ticker', label: 'Symbol' },
                      {
                        key: 'v',
                        label: 'Vs VWAP',
                        right: true,
                        render: (r) => <DeltaPct value={r.vwapDeviationPct} />,
                      },
                    ]}
                  />
                </div>
              </TableShell>

              <TableShell title="Liquidity leaders">
                <div className="p-4 sm:p-5">
                  <ScannerTopFiveTable
                    hideHeader
                    rows={scanners?.liquidityLeaders}
                    navigate={navigate}
                    columns={[
                      { key: 'ticker', label: 'Symbol' },
                      {
                        key: 'price',
                        label: 'Price',
                        right: true,
                        render: (r) =>
                          r.price == null
                            ? '—'
                            : new Intl.NumberFormat(undefined, {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 2,
                              }).format(r.price),
                      },
                      {
                        key: 'chg',
                        label: 'Chg%',
                        right: true,
                        render: (r) => <DeltaPct value={r.changePercent} />,
                      },
                    ]}
                  />
                </div>
              </TableShell>
            </div>
          )}
        </>
      )}
    </div>
  )
}
