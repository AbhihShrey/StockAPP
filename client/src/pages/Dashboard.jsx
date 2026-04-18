import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardCard } from '../components/DashboardCard'
import { GlobalAssetMarquee } from '../components/GlobalAssetMarquee'
import { MarketBreadthGauge } from '../components/MarketBreadthGauge'
import { MarketSentiment } from '../components/MarketSentiment'
import { RelatedStrengthWidget } from '../components/RelatedStrengthWidget'
import { SectorStrengthGrid } from '../components/SectorStrengthGrid'
import { TableShell } from '../components/TableShell'
import { TradingViewTickerTape } from '../components/TradingViewTickerTape'
import { VolatilityHeatmapWidget } from '../components/VolatilityHeatmapWidget'
import { TableRowsSkeleton } from '../components/DataSkeleton'
import { MiniPriceChart } from '../components/MiniPriceChart'
import { apiUrl } from '../lib/apiBase'

const DEFAULT_POLL_MS = 120_000

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined).format(n)
  } catch {
    return String(n)
  }
}

function formatPrice(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return String(n)
  }
}

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

async function loadJson(path) {
  const res = await fetch(apiUrl(path))
  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  let json = null
  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`API 404: ${path}`)
    }
    if (!json && text.trim().startsWith('<!DOCTYPE')) {
      throw new Error('API returned HTML. Is the backend running on port 3001?')
    }
    throw new Error(json?.message ?? `Failed to load ${path}`)
  }
  return json
}

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [breadth, setBreadth] = useState(null)
  const [breadthError, setBreadthError] = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [sentimentError, setSentimentError] = useState(null)
  const [globalAssets, setGlobalAssets] = useState(null)
  const [globalAssetsError, setGlobalAssetsError] = useState(null)
  const [sectors, setSectors] = useState(null)
  const [sectorsError, setSectorsError] = useState(null)
  const [volHeatmap, setVolHeatmap] = useState(null)
  const [volHeatmapError, setVolHeatmapError] = useState(null)
  const [selectedSector, setSelectedSector] = useState(null)
  const [related, setRelated] = useState(null)
  const [relatedError, setRelatedError] = useState(null)
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [searchTop, setSearchTop] = useState('')
  const [pollMs, setPollMs] = useState(DEFAULT_POLL_MS)

  const marketRegime = useMemo(() => {
    const pct = breadth?.pctAbove200dma
    const z = breadth?.zScore24h
    const sentimentScore = sentiment?.score

    if (pct == null || !Number.isFinite(pct)) return { label: '—', hint: 'Waiting for breadth…' }

    if (z != null && Number.isFinite(z) && z <= -1.5) {
      return { label: 'Mean reverting (oversold)', hint: 'Extremes often snap back' }
    }
    if (z != null && Number.isFinite(z) && z >= 1.5) {
      return { label: 'Trending bullish (overbought)', hint: 'Momentum day risk is higher' }
    }

    if (sentimentScore != null && Number.isFinite(sentimentScore)) {
      if (sentimentScore >= 70 && pct >= 55) return { label: 'Trending bullish', hint: 'Breakouts / VWAP trend' }
      if (sentimentScore <= 35 && pct <= 45) return { label: 'Choppy / risk-off', hint: 'Be selective' }
    }

    return { label: 'Choppy', hint: 'Opening range works best with follow-through' }
  }, [breadth, sentiment])

  const loadRelated = useCallback(async (sectorSymbol) => {
    const sym = String(sectorSymbol ?? '').trim().toUpperCase()
    if (!sym) return
    setRelatedLoading(true)
    setRelatedError(null)
    try {
      const json = await loadJson(`/api/predictive/sector-related?symbol=${encodeURIComponent(sym)}`)
      setRelated(json)
    } catch (e) {
      setRelatedError(e instanceof Error ? e.message : 'Related strength failed')
      setRelated(null)
    } finally {
      setRelatedLoading(false)
    }
  }, [])

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
      setError(null)
      setBreadthError(null)
      setSentimentError(null)
      setGlobalAssetsError(null)
      setSectorsError(null)
      setVolHeatmapError(null)
    }
    try {
      const [summary, breadthJson, sentimentJson, globalJson, sectorsJson, volJson] = await Promise.all([
        loadJson('/api/market-summary'),
        loadJson('/api/market-breadth').catch((e) => {
          if (!silent) setBreadthError(e instanceof Error ? e.message : 'Breadth failed')
          return null
        }),
        loadJson('/api/market-sentiment').catch((e) => {
          if (!silent) setSentimentError(e instanceof Error ? e.message : 'Sentiment failed')
          return null
        }),
        loadJson('/api/global-assets').catch((e) => {
          if (!silent) setGlobalAssetsError(e instanceof Error ? e.message : 'Global assets failed')
          return null
        }),
        loadJson('/api/dashboard-sectors').catch((e) => {
          if (!silent) setSectorsError(e instanceof Error ? e.message : 'Sectors failed')
          return null
        }),
        loadJson('/api/predictive/vol-heatmap').catch((e) => {
          if (!silent) setVolHeatmapError(e instanceof Error ? e.message : 'Heatmap failed')
          return null
        }),
      ])
      setData(summary)
      if (breadthJson) {
        setBreadth(breadthJson)
        setBreadthError(null)
      }
      if (sentimentJson) {
        setSentiment(sentimentJson)
        setSentimentError(null)
      }
      if (globalJson) {
        setGlobalAssets(globalJson)
        setGlobalAssetsError(null)
      }
      if (sectorsJson) {
        setSectors(sectorsJson)
        setSectorsError(null)
      }
      if (volJson) {
        setVolHeatmap(volJson)
        setVolHeatmapError(null)
      }
      const ri = Number(summary?.refreshIntervalMs)
      if (Number.isFinite(ri) && ri >= 15_000) setPollMs(ri)
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

  const topStocks = useMemo(() => {
    const rows = Array.isArray(data?.topStocks) ? data.topStocks : []
    const q = searchTop.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => String(r?.symbol ?? '').toLowerCase().includes(q))
  }, [data, searchTop])

  return (
    <div className="space-y-6">
      <TradingViewTickerTape />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          Dashboard
        </h1>
      </header>

      {error && !data ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-200">
          <p className="font-medium">Couldn’t load market summary</p>
          <p className="mt-1 text-rose-200/80">{error}</p>
        </div>
      ) : (
        <>
          <div className="dash-module-enter" style={{ ['--dash-stagger']: '0ms' }}>
            <DashboardCard title="Global asset pulse">
              <GlobalAssetMarquee data={globalAssets} loading={loading && !globalAssets} error={globalAssetsError} />
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <div className="dash-module-enter" style={{ ['--dash-stagger']: '60ms' }}>
              <DashboardCard title="Market breadth">
                <div className="space-y-4">
                  <MarketBreadthGauge data={breadth} loading={loading && !breadth} error={breadthError} />
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Market regime
                    </p>
                    <p className="mt-2 text-base font-semibold tracking-tight text-zinc-100">{marketRegime.label}</p>
                    <p className="mt-1 text-sm text-zinc-500">{marketRegime.hint}</p>
                  </div>
                </div>
              </DashboardCard>
            </div>
            <div className="dash-module-enter" style={{ ['--dash-stagger']: '85ms' }}>
              <DashboardCard title="Market sentiment">
                <MarketSentiment data={sentiment} loading={loading && !sentiment} error={sentimentError} />
              </DashboardCard>
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
            <div className="dash-module-enter lg:col-span-8" style={{ ['--dash-stagger']: '130ms' }}>
              <DashboardCard title="SPDR sector strength">
                <SectorStrengthGrid
                  data={sectors}
                  loading={loading && !sectors}
                  error={sectorsError}
                  onSelect={(row) => {
                    setSelectedSector({ symbol: row?.symbol, name: row?.name })
                    loadRelated(row?.symbol)
                  }}
                />
              </DashboardCard>
            </div>

            <div className="dash-module-enter lg:col-span-4" style={{ ['--dash-stagger']: '150ms' }}>
              <DashboardCard title="Related strength" className="h-full">
                <div className="related-panel-shell">
                  {selectedSector ? (
                    <div key={selectedSector?.symbol ?? 'related'} className="related-panel-enter">
                      <MiniPriceChart symbol={selectedSector?.symbol} />
                      <div className="mt-3">
                      <RelatedStrengthWidget
                        selected={selectedSector}
                        data={related}
                        loading={relatedLoading}
                        error={relatedError}
                        onClose={() => {
                          setSelectedSector(null)
                          setRelated(null)
                          setRelatedError(null)
                        }}
                      />
                      </div>
                    </div>
                  ) : (
                    <div className="related-panel-empty" aria-label="Related strength empty" />
                  )}
                </div>
              </DashboardCard>
            </div>
          </div>

          <div className="dash-module-enter" style={{ ['--dash-stagger']: '185ms' }}>
            <DashboardCard title="Volatility heatmap (next 1h)">
              <VolatilityHeatmapWidget
                data={volHeatmap}
                loading={loading && !volHeatmap}
                error={volHeatmapError}
              />
            </DashboardCard>
          </div>

          <div className="dash-module-enter" style={{ ['--dash-stagger']: '240ms' }}>
            <TableShell title="Top 20 (Most Active)" search={searchTop} setSearch={setSearchTop}>
              <div className="max-h-[22rem] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-1/70 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                    <tr className="border-b border-border-subtle">
                      <th className="px-4 py-2.5 font-medium">Symbol</th>
                      <th className="px-4 py-2.5 font-medium">Last</th>
                      <th className="px-4 py-2.5 font-medium">Vol</th>
                      <th className="px-4 py-2.5 font-medium text-right">Chg%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/70">
                    {!data ? (
                      <TableRowsSkeleton rows={10} cols={4} />
                    ) : (
                      <>
                        {topStocks.map((r) => {
                          const chg = Number(r?.changePercent)
                          const up = Number.isFinite(chg) && chg > 0
                          const down = Number.isFinite(chg) && chg < 0
                          const pill = up
                            ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20'
                            : down
                              ? 'bg-rose-500/10 text-rose-200 ring-rose-500/20'
                              : 'bg-white/5 text-zinc-300 ring-white/10'
                          return (
                            <tr key={r?.symbol} className="hover:bg-white/5">
                              <td className="px-4 py-2.5 font-semibold text-zinc-100">{r?.symbol ?? '—'}</td>
                              <td className="px-4 py-2.5 text-zinc-300 tabular-nums">
                                {formatPrice(r?.close ?? r?.price)}
                              </td>
                              <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{formatNumber(r?.volume)}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span
                                  className={[
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium tabular-nums ring-1',
                                    pill,
                                  ].join(' ')}
                                >
                                  {formatPct(r?.changePercent)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                        {topStocks.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-center text-sm text-zinc-500" colSpan={4}>
                              No matches.
                            </td>
                          </tr>
                        ) : null}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </TableShell>
          </div>
        </>
      )}
    </div>
  )
}
