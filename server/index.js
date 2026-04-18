import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getChartsUniverse } from './services/chartsUniverse.js'
import { getDashboardSectors } from './services/dashboardSectors.js'
import { getGlobalAssets } from './services/globalAssets.js'
import { getGridScores } from './services/gridScores.js'
import { getMarketBreadth } from './services/marketBreadth.js'
import { getMarketMovers } from './services/marketMovers.js'
import { getMarketSentiment } from './services/marketSentiment.js'
import { getMarketSummary } from './services/marketSummary.js'
import { getVolatilityHeatmap } from './services/predictiveVol.js'
import { fetchBacktestStrategies, runBacktest } from './services/backtestClient.js'
import { getSectorQuadrant } from './services/sectorQuadrant.js'
import { getVwapChartData } from './services/vwapData.js'
import { getSectorRelatedStrength } from './services/sectorRelatedStrength.js'
import { getMarketInternals } from './services/marketInternals.js'
import { getMarketScanners } from './services/marketScanners.js'
import { getEarningsCalendarForDate } from './services/earningsCalendar.js'
import { getEconomicCalendarRange } from './services/economicCalendar.js'
import { getStockNewsFeed, getStockNewsSnapshot } from './services/stockNews.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const app = express()
const PORT = process.env.PORT ?? 3001

function statusForProviderError(err) {
  if (!err || typeof err !== 'object') return 500
  const c = err.code
  if (
    c === 'FMP_KEY_MISSING' ||
    c === 'FMP_RATE_LIMIT' ||
    c === 'FMP_FORBIDDEN' ||
    c === 'FMP_HTTP' ||
    c === 'BACKTEST_UNAVAILABLE'
  ) {
    return 503
  }
  if (c === 'BACKTEST_BAD_REQUEST' || c === 'BAD_REQUEST') return 400
  return 500
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'investaiv1-api' })
})

app.get('/api/market-summary', async (_req, res) => {
  try {
    const summary = await getMarketSummary()
    res.json(summary)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'market_summary_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

function publicMoverRow(row) {
  return {
    ticker: row.ticker,
    price: row.price,
    changePercent: row.changePercent,
    volume: row.volume,
  }
}

async function sectorHandler(_req, res) {
  try {
    const data = await getSectorQuadrant()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'sectors_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

app.get('/api/sectors', sectorHandler)
app.get('/api/sector-quadrant', sectorHandler)

app.get('/api/grid-scores', async (_req, res) => {
  try {
    const data = await getGridScores()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'grid_scores_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/charts-universe', async (_req, res) => {
  try {
    const data = await getChartsUniverse()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'charts_universe_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/market-breadth', async (_req, res) => {
  try {
    const data = await getMarketBreadth()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'market_breadth_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/market-internals', async (_req, res) => {
  try {
    const data = await getMarketInternals()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'market_internals_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/market-sentiment', async (_req, res) => {
  try {
    const data = await getMarketSentiment()
    res.json(data)
  } catch (err) {
    const code = err?.code === 'SENTIMENT_HTTP' ? 503 : statusForProviderError(err)
    res.status(code).json({
      ok: false,
      error: 'market_sentiment_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/predictive/vol-heatmap', async (_req, res) => {
  try {
    const data = await getVolatilityHeatmap()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'predictive_vol_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/predictive/sector-related', async (req, res) => {
  try {
    const { symbol } = req.query ?? {}
    const data = await getSectorRelatedStrength(symbol)
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'sector_related_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/dashboard-sectors', async (_req, res) => {
  try {
    const data = await getDashboardSectors()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'dashboard_sectors_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/vwap', async (req, res) => {
  try {
    const { symbol, start, end } = req.query ?? {}
    const data = await getVwapChartData(symbol, start, end)
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'vwap_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/global-assets', async (_req, res) => {
  try {
    const data = await getGlobalAssets()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'global_assets_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/market-scanners', async (_req, res) => {
  try {
    const data = await getMarketScanners()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'market_scanners_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/earnings-calendar', async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : undefined
    const data = await getEarningsCalendarForDate(date)
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'earnings_calendar_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/economic-calendar', async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : undefined
    const data = await getEconomicCalendarRange(date)
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'economic_calendar_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/stock-news', async (req, res) => {
  try {
    const data = await getStockNewsFeed(req.query ?? {})
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'stock_news_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/stock-news/snapshot', async (req, res) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : ''
    if (!symbol.trim()) {
      res.status(400).json({ ok: false, error: 'bad_request', message: 'symbol is required' })
      return
    }
    const data = await getStockNewsSnapshot(symbol)
    res.json(data)
  } catch (err) {
    const code = err?.code === 'BAD_REQUEST' ? 400 : statusForProviderError(err)
    res.status(code).json({
      ok: false,
      error: 'stock_news_snapshot_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/backtest/strategies', async (_req, res) => {
  try {
    const data = await fetchBacktestStrategies()
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'backtest_strategies_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.post('/api/backtest/run', async (req, res) => {
  try {
    const { symbol, strategyId, start, end, params } = req.body ?? {}
    if (!symbol || !strategyId) {
      res.status(400).json({
        ok: false,
        error: 'bad_request',
        message: 'symbol and strategyId are required',
      })
      return
    }
    const result = await runBacktest({ symbol, strategyId, start, end, params })
    res.json(result)
  } catch (err) {
    const status = statusForProviderError(err)
    res.status(status).json({
      ok: false,
      error: 'backtest_run_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/market-movers', async (_req, res) => {
  try {
    const movers = await getMarketMovers()
    res.json({
      asOf: movers.asOf,
      source: movers.source,
      cached: movers.cached,
      refreshIntervalMs: movers.refreshIntervalMs,
      gainers: movers.gainers.map(publicMoverRow),
      losers: movers.losers.map(publicMoverRow),
      mostActive: movers.mostActive.map(publicMoverRow),
    })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'market_movers_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.listen(PORT, () => {
  console.log(`API at http://localhost:${PORT}`)
  console.log(
    `[server] FMP_API_KEY ${process.env.FMP_API_KEY?.trim() ? 'is set' : 'is MISSING'} (Financial Modeling Prep)`,
  )
  console.log(
    `[server] Backtests → ${process.env.BACKTEST_SERVICE_URL?.trim() || 'http://127.0.0.1:8765'} (vectorbt / vectorbtpro)`,
  )
})
