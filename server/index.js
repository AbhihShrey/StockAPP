import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import './db.js'
import { requireAuth } from './middleware/requireAuth.js'
import { verifyToken } from './services/authService.js'
import { authenticateUser, createUser } from './services/authService.js'
import { addToWatchlist, getWatchlistWithQuotes, removeFromWatchlist, validateSymbol } from './services/watchlistService.js'
import { getScreenerFilters, runScreener, saveScreenerFilters } from './services/screenerService.js'
import { createAlert, deleteAlert, getAlertHistoryByUser, getAlertsByUser, getNotificationSettings, saveNotificationSettings, toggleAlert } from './services/alertService.js'
import { runAlertCheck, setWsBroadcast, startAlertEngine } from './services/alertEngine.js'
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

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'bad_request', message: 'email and password are required' })
      return
    }
    const result = await createUser(email, password)
    if (!result.ok) {
      res.status(409).json({ ok: false, error: 'signup_failed', message: result.error })
      return
    }
    res.status(201).json({ ok: true, token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'signup_error', message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'bad_request', message: 'email and password are required' })
      return
    }
    const result = await authenticateUser(email, password)
    if (!result.ok) {
      res.status(401).json({ ok: false, error: 'auth_failed', message: result.error })
      return
    }
    res.json({ ok: true, token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'login_error', message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

// ── Watchlist ────────────────────────────────────────────────────────────────

app.get('/api/watchlist', requireAuth, async (req, res) => {
  try {
    const data = await getWatchlistWithQuotes(req.user.id)
    res.json({ ok: true, items: data })
  } catch (err) {
    res.status(statusForProviderError(err)).json({ ok: false, error: 'watchlist_failed', message: err.message })
  }
})

app.post('/api/watchlist', requireAuth, async (req, res) => {
  const { symbol } = req.body ?? {}
  if (!symbol) {
    res.status(400).json({ ok: false, error: 'bad_request', message: 'symbol is required' })
    return
  }
  const valid = await validateSymbol(symbol)
  if (!valid) {
    res.status(400).json({ ok: false, error: 'invalid_symbol', message: 'Symbol not found. Please verify the ticker.' })
    return
  }
  const result = addToWatchlist(req.user.id, symbol)
  if (!result.ok) {
    res.status(409).json({ ok: false, error: 'watchlist_conflict', message: result.error })
    return
  }
  res.status(201).json({ ok: true, symbol: result.symbol })
})

app.delete('/api/watchlist/:symbol', requireAuth, (req, res) => {
  const result = removeFromWatchlist(req.user.id, req.params.symbol)
  if (!result.ok) {
    res.status(404).json({ ok: false, error: 'not_found', message: result.error })
    return
  }
  res.json({ ok: true })
})

// ── Screener ─────────────────────────────────────────────────────────────────

app.get('/api/screener/filters', requireAuth, (req, res) => {
  const filters = getScreenerFilters(req.user.id)
  res.json({ ok: true, filters })
})

app.post('/api/screener/filters', requireAuth, (req, res) => {
  const { filters } = req.body ?? {}
  if (!filters || typeof filters !== 'object') {
    res.status(400).json({ ok: false, error: 'bad_request', message: 'filters object is required' })
    return
  }
  saveScreenerFilters(req.user.id, filters)
  res.json({ ok: true })
})

app.post('/api/screener/run', requireAuth, async (req, res) => {
  try {
    const { filters } = req.body ?? {}
    const results = await runScreener(filters ?? {})
    res.json({ ok: true, results })
  } catch (err) {
    res.status(statusForProviderError(err)).json({ ok: false, error: 'screener_failed', message: err.message })
  }
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

// ── Alerts ────────────────────────────────────────────────────────────────────

app.get('/api/alerts', requireAuth, (req, res) => {
  res.json({ ok: true, alerts: getAlertsByUser(req.user.id) })
})

app.post('/api/alerts', requireAuth, (req, res) => {
  const { symbol, condition, threshold, cooldown_minutes } = req.body ?? {}
  const result = createAlert(req.user.id, { symbol, condition, threshold, cooldown_minutes })
  if (!result.ok) {
    res.status(400).json({ ok: false, error: 'create_alert_failed', message: result.error })
    return
  }
  res.status(201).json({ ok: true, alert: result.alert })
})

app.patch('/api/alerts/:id', requireAuth, (req, res) => {
  const { is_active } = req.body ?? {}
  const result = toggleAlert(req.user.id, Number(req.params.id), Boolean(is_active))
  if (!result.ok) {
    res.status(404).json({ ok: false, error: 'not_found', message: result.error })
    return
  }
  res.json({ ok: true })
})

app.delete('/api/alerts/:id', requireAuth, (req, res) => {
  const result = deleteAlert(req.user.id, Number(req.params.id))
  if (!result.ok) {
    res.status(404).json({ ok: false, error: 'not_found', message: result.error })
    return
  }
  res.json({ ok: true })
})

app.get('/api/alerts/history', requireAuth, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50)
  res.json({ ok: true, history: getAlertHistoryByUser(req.user.id, limit) })
})

/** Manual alert-engine tick for local testing (`NODE_ENV=development` or ALERTS_DEBUG_ENDPOINT=1). */
app.post('/api/alerts/run-check-once', requireAuth, async (req, res) => {
  const allowed =
    process.env.NODE_ENV === 'development' || String(process.env.ALERTS_DEBUG_ENDPOINT ?? '').trim() === '1'
  if (!allowed) {
    res.status(404).json({ ok: false, error: 'not_found' })
    return
  }
  try {
    await runAlertCheck()
    res.json({ ok: true, message: 'Alert engine tick finished (fires only when conditions match FMP quotes).' })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/notifications/settings', requireAuth, (req, res) => {
  const settings = getNotificationSettings(req.user.id)
  res.json({ ok: true, settings: { email_alerts_enabled: settings?.email_alerts_enabled === 1, alert_email: settings?.alert_email ?? '' } })
})

app.patch('/api/notifications/settings', requireAuth, (req, res) => {
  const { email_alerts_enabled, alert_email } = req.body ?? {}
  saveNotificationSettings(req.user.id, { email_alerts_enabled, alert_email })
  res.json({ ok: true })
})

// ── HTTP + WebSocket server ──────────────────────────────────────────────────

const httpServer = createServer(app)

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

// Map<userId, Set<ws>> to support multiple tabs per user
const wsClients = new Map()

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost`)
  const token = url.searchParams.get('token')
  const payload = token ? verifyToken(token) : null
  if (!payload) { ws.close(4001, 'Unauthorized'); return }

  const userId = payload.sub
  if (!wsClients.has(userId)) wsClients.set(userId, new Set())
  wsClients.get(userId).add(ws)

  const cleanup = () => {
    const set = wsClients.get(userId)
    if (set) { set.delete(ws); if (set.size === 0) wsClients.delete(userId) }
  }
  ws.on('close', cleanup)
  ws.on('error', cleanup)
  ws.send(JSON.stringify({ type: 'connected', userId }))
})

// Returns true if at least one socket was open (so engine knows WS was delivered)
setWsBroadcast((userId, payload) => {
  const set = wsClients.get(userId)
  if (!set || set.size === 0) return false
  const msg = JSON.stringify(payload)
  let delivered = false
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) { ws.send(msg); delivered = true }
  }
  return delivered
})

httpServer.listen(PORT, () => {
  console.log(`API at http://localhost:${PORT}`)
  console.log(
    `[server] FMP_API_KEY ${process.env.FMP_API_KEY?.trim() ? 'is set' : 'is MISSING'} (Financial Modeling Prep)`,
  )
  console.log(
    `[server] Backtests → ${process.env.BACKTEST_SERVICE_URL?.trim() || 'http://127.0.0.1:8765'} (vectorbt / vectorbtpro)`,
  )
  startAlertEngine()
})
