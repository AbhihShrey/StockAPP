import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import db from './db.js'
import { requireAuth } from './middleware/requireAuth.js'
import { authenticateUser, changePassword, createUser, deleteUserAccount, verifyToken } from './services/authService.js'
import { consumeEmailVerifyToken, consumePasswordResetToken, createEmailVerifyToken, createPasswordResetTokenForEmail } from './services/tokenService.js'
import { sendPasswordResetEmail, sendVerifyEmail } from './services/emailService.js'
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  issueAuthToken,
  issueChallengeToken,
  setupTwoFactor,
  userRequiresTwoFactor,
  verifyChallengeToken,
  verifyTotpCode,
} from './services/twoFactorService.js'
import { addToWatchlist, getWatchlistWithQuotes, removeFromWatchlist, validateSymbol } from './services/watchlistService.js'
import { getScreenerFilters, runScreener, saveScreenerFilters } from './services/screenerService.js'
import { createAlert, deleteAlert, getAlertHistoryByUser, getAlertsByUser, getUserSettings, reactivateAllAlerts, toggleAlert, updateAlertCooldown, updateUserSettings } from './services/alertService.js'
import { broadcastToUser, fetchBarsForDate, fetchTodayBars, runAlertCheck, setWsBroadcast, startAlertEngine } from './services/alertEngine.js'
import { startCleanupJobs } from './services/cleanupJobs.js'
import { getChartsUniverse } from './services/chartsUniverse.js'
import { getDashboardSectors } from './services/dashboardSectors.js'
import { getGlobalAssets } from './services/globalAssets.js'
import { getGridScores } from './services/gridScores.js'
import { getMarketBreadth } from './services/marketBreadth.js'
import { getMarketMovers } from './services/marketMovers.js'
import { getMarketHeatmap } from './services/marketHeatmap.js'
import {
  getCongressFeed,
  getCongressForSymbol,
  getInsiderFeed,
  getInsiderForSymbol,
} from './services/insiderTrading.js'
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
import { getIpoCalendar } from './services/ipoCalendar.js'
import { getFundamentals } from './services/fundamentals.js'
import { getStockNewsFeed, getStockNewsSnapshot } from './services/stockNews.js'
import { fetchBatchQuotesBySymbols, fmpGet } from './services/fmp.js'
import { getAnalystRating, getAnalystRatingsBatch } from './services/analystRatings.js'
import { dismissEarningsDateBadge, fetchNextEarnings } from './services/earningsAlerts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT ?? 3001

function alertTestRoutesEnabled() {
  return (
    process.env.NODE_ENV === 'development' ||
    String(process.env.ALERTS_DEBUG_ENDPOINT ?? '').trim() === '1' ||
    String(process.env.ALERTS_SIMULATION_ENABLED ?? '').trim() === '1'
  )
}

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

const corsOriginsEnv = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
const corsAllowAll = process.env.NODE_ENV !== 'production' && corsOriginsEnv.length === 0
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(
  cors({
    origin: corsAllowAll ? true : corsOriginsEnv,
    credentials: true,
  }),
)
app.use(express.json({ limit: '256kb' }))

const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'rate_limited', message: 'Too many requests — slow down.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'rate_limited', message: 'Too many attempts — try again in a few minutes.' },
})

const PUBLIC_RATE_LIMITED_PATHS = [
  '/api/market-summary',
  '/api/sectors',
  '/api/sector-quadrant',
  '/api/grid-scores',
  '/api/charts-universe',
  '/api/market-breadth',
  '/api/market-internals',
  '/api/market-sentiment',
  '/api/predictive/vol-heatmap',
  '/api/predictive/sector-related',
  '/api/dashboard-sectors',
  '/api/vwap',
  '/api/global-assets',
  '/api/market-scanners',
  '/api/earnings-calendar',
  '/api/economic-calendar',
  '/api/ipo-calendar',
  '/api/stock-news',
  '/api/stock-news/snapshot',
  '/api/backtest/strategies',
  '/api/backtest/run',
  '/api/markets-heatmap',
  '/api/market-movers',
]
for (const p of PUBLIC_RATE_LIMITED_PATHS) {
  app.use(p, publicLimiter)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ember-finances-api' })
})

app.post('/api/auth/signup', authLimiter, async (req, res) => {
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
    // Fire-and-forget verification email — must not block the signup response
    // and must never bubble an error to the user (we don't gate login on it).
    try {
      const issued = createEmailVerifyToken(result.user.id, result.user.email)
      sendVerifyEmail(result.user.email, {
        verifyUrl: issued.verifyUrl,
        expiresInMinutes: issued.expiresInMinutes,
      }).catch((err) => console.error('[auth] verify email send failed:', err.message))
    } catch (err) {
      console.error('[auth] verify email issuance failed:', err.message)
    }
    res.status(201).json({ ok: true, token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'signup_error', message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
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
    if (userRequiresTwoFactor(result.user.id)) {
      const challenge_token = issueChallengeToken(result.user.id, result.user.email)
      return res.json({ ok: true, twofa_required: true, challenge_token })
    }
    res.json({ ok: true, token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'login_error', message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post('/api/auth/2fa/challenge', authLimiter, async (req, res) => {
  try {
    const { challenge_token, code } = req.body ?? {}
    const payload = verifyChallengeToken(challenge_token)
    if (!payload) return res.status(401).json({ ok: false, message: 'Challenge expired. Sign in again.' })
    const result = await verifyTotpCode(payload.sub, code)
    if (!result.ok) return res.status(401).json({ ok: false, message: result.error })
    const token = issueAuthToken(payload.sub, payload.email)
    res.json({
      ok: true,
      token,
      user: { id: payload.sub, email: payload.email },
      backupCodesRemaining: result.used === 'backup' ? result.remaining : undefined,
    })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/auth/2fa', requireAuth, (req, res) => {
  res.json({ ok: true, ...getTwoFactorStatus(req.user.id) })
})

app.post('/api/auth/2fa/setup', requireAuth, async (req, res) => {
  try {
    const status = getTwoFactorStatus(req.user.id)
    if (status.enabled) {
      return res.status(409).json({ ok: false, message: '2FA is already enabled. Disable it first to re-provision.' })
    }
    const { otpauthUri, backupCodes } = await setupTwoFactor(req.user.id, req.user.email)
    res.json({ ok: true, otpauthUri, backupCodes })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post('/api/auth/2fa/enable', requireAuth, (req, res) => {
  const { code } = req.body ?? {}
  const result = enableTwoFactor(req.user.id, code)
  if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
  res.json({ ok: true })
})

app.delete('/api/auth/2fa', requireAuth, async (req, res) => {
  try {
    const { password } = req.body ?? {}
    const result = await disableTwoFactor(req.user.id, password)
    if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(req.user.id)
  if (!row) {
    return res.status(404).json({ ok: false, message: 'User not found.' })
  }
  res.json({
    ok: true,
    user: { id: row.id, email: row.email, emailVerified: Boolean(row.email_verified) },
  })
})

app.get('/api/auth/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const result = consumeEmailVerifyToken(token)
  if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
  res.json({ ok: true })
})

app.post('/api/auth/resend-verification', authLimiter, requireAuth, async (req, res) => {
  try {
    const row = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(req.user.id)
    if (!row) return res.status(404).json({ ok: false, message: 'User not found.' })
    if (row.email_verified) return res.json({ ok: true, alreadyVerified: true })
    const issued = createEmailVerifyToken(row.id, row.email)
    try {
      await sendVerifyEmail(row.email, {
        verifyUrl: issued.verifyUrl,
        expiresInMinutes: issued.expiresInMinutes,
      })
    } catch (err) {
      console.error('[auth] resend verification email failed:', err.message)
      return res.status(503).json({ ok: false, message: 'Could not send verification email. Please try again later.' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  // Always respond 200 so we never leak whether an email exists.
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({ ok: true })
    }
    const issued = createPasswordResetTokenForEmail(email)
    if (issued) {
      try {
        await sendPasswordResetEmail(issued.user.email, {
          resetUrl: issued.resetUrl,
          expiresInMinutes: issued.expiresInMinutes,
        })
      } catch (err) {
        console.error('[auth] forgot-password email send failed:', err.message)
      }
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[auth] forgot-password error:', err.message)
    res.json({ ok: true })
  }
})

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body ?? {}
    const result = await consumePasswordResetToken(token, newPassword)
    if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.delete('/api/user', requireAuth, async (req, res) => {
  try {
    const { password, confirm } = req.body ?? {}
    if (confirm !== 'DELETE') {
      return res.status(400).json({ ok: false, message: 'Confirmation phrase must be the word DELETE.' })
    }
    if (!password) {
      return res.status(400).json({ ok: false, message: 'Password is required.' })
    }
    const result = await deleteUserAccount(req.user.id, password)
    if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/user/export', requireAuth, (req, res) => {
  try {
    const userId = req.user.id
    const user = db.prepare(
      'SELECT id, email, email_alerts_enabled, alert_email, email_verified, created_at FROM users WHERE id = ?',
    ).get(userId)
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' })

    const watchlists = db.prepare(
      'SELECT symbol, added_at FROM watchlists WHERE user_id = ? ORDER BY added_at',
    ).all(userId)
    const alerts = db.prepare(
      `SELECT id, symbol, condition, threshold, alert_type, is_active, cooldown_minutes,
              last_fired_at, created_at
       FROM alerts WHERE user_id = ? ORDER BY created_at`,
    ).all(userId)
    const alertHistory = db.prepare(
      `SELECT alert_id, symbol, condition, threshold, triggered_price, vwap_at_trigger, triggered_at
       FROM alert_history WHERE user_id = ? ORDER BY triggered_at`,
    ).all(userId)
    const screenerRow = db.prepare(
      'SELECT filters, updated_at FROM screener_filters WHERE user_id = ?',
    ).get(userId)
    const screenerFilters = screenerRow
      ? { filters: JSON.parse(screenerRow.filters || '{}'), updated_at: screenerRow.updated_at }
      : null
    const totp = db.prepare(
      'SELECT enabled, created_at FROM totp_secrets WHERE user_id = ?',
    ).get(userId)

    const payload = {
      exported_at: new Date().toISOString(),
      app: 'Ember Finances',
      user,
      watchlists,
      alerts,
      alert_history: alertHistory,
      screener_filters: screenerFilters,
      two_factor: totp ? { enabled: Boolean(totp.enabled), created_at: totp.created_at } : null,
    }

    const filename = `ember-finances-export-${user.email.replace(/[^a-z0-9]+/gi, '_')}-${Date.now()}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(payload, null, 2))
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Export failed.' })
  }
})

app.patch('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, message: 'currentPassword and newPassword are required' })
    }
    const result = await changePassword(req.user.id, currentPassword, newPassword)
    if (!result.ok) return res.status(400).json({ ok: false, message: result.error })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message })
  }
})

// ── User settings ────────────────────────────────────────────────────────────

app.get('/api/user/settings', requireAuth, (req, res) => {
  const settings = getUserSettings(req.user.id)
  if (!settings) return res.status(404).json({ ok: false, message: 'User not found.' })
  res.json({ ok: true, settings })
})

app.patch('/api/user/settings', requireAuth, (req, res) => {
  const { email_alerts_enabled, email_digest_enabled, alert_email } = req.body ?? {}
  const result = updateUserSettings(req.user.id, {
    email_alerts_enabled,
    email_digest_enabled,
    alert_email,
  })
  res.json({ ok: true, settings: result })
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

app.get('/api/ipo-calendar', async (req, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    const isoRe = /^\d{4}-\d{2}-\d{2}$/
    if (!isoRe.test(from) || !isoRe.test(to)) {
      return res.status(400).json({ ok: false, message: 'from/to must be YYYY-MM-DD' })
    }
    const data = await getIpoCalendar({ from, to })
    res.json({ ok: true, ...data })
  } catch (err) {
    const status = err?.code === 'BAD_REQUEST' ? 400 : statusForProviderError(err)
    res.status(status).json({
      ok: false,
      error: 'ipo_calendar_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/fundamentals/:symbol', requireAuth, async (req, res) => {
  try {
    const symbol = String(req.params.symbol ?? '').trim().toUpperCase()
    if (!symbol || symbol.length > 12) {
      return res.status(400).json({ ok: false, error: 'bad_request', message: 'symbol is required' })
    }
    const data = await getFundamentals(symbol)
    res.json(data)
  } catch (err) {
    const status = err?.code === 'BAD_REQUEST' ? 400 : statusForProviderError(err)
    res.status(status).json({
      ok: false,
      error: 'fundamentals_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 64) : ''
    if (query.length < 1) return res.json({ ok: true, results: [] })
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10))
    const data = await fmpGet('/search-symbol', { query, limit })
    const results = (Array.isArray(data) ? data : []).slice(0, limit).map((r) => ({
      symbol: String(r?.symbol ?? '').toUpperCase(),
      name: r?.name ?? '',
      exchange: r?.exchange ?? r?.exchangeShortName ?? '',
      currency: r?.currency ?? '',
    })).filter((r) => r.symbol)
    res.json({ ok: true, results })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'search_failed',
      message: err instanceof Error ? err.message : 'Search unavailable',
    })
  }
})

app.get('/api/quotes', requireAuth, async (req, res) => {
  try {
    const raw = typeof req.query.symbols === 'string' ? req.query.symbols.trim() : ''
    const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 40)
    if (symbols.length === 0) return res.json({ ok: true, quotes: [] })
    const map = await fetchBatchQuotesBySymbols(symbols)
    const quotes = symbols.map((sym) => {
      const q = map.get(sym) ?? {}
      return { symbol: sym, price: q.price ?? null, changePercent: q.changePercent ?? null, change: q.change ?? null, volume: q.volume ?? null, open: q.open ?? null, previousClose: q.previousClose ?? null }
    })
    res.json({ ok: true, quotes })
  } catch (err) {
    res.status(statusForProviderError(err)).json({ ok: false, message: err.message })
  }
})

app.get('/api/analyst-rating/:symbol', requireAuth, async (req, res) => {
  try {
    const symbol = String(req.params.symbol ?? '').trim().toUpperCase()
    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'bad_request', message: 'symbol is required' })
    }
    const rating = await getAnalystRating(symbol)
    res.json({ ok: true, symbol, rating })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'analyst_rating_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/analyst-ratings', requireAuth, async (req, res) => {
  try {
    const raw = typeof req.query.symbols === 'string' ? req.query.symbols : ''
    const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 60)
    if (symbols.length === 0) return res.json({ ok: true, ratings: {} })
    const ratings = await getAnalystRatingsBatch(symbols)
    res.json({ ok: true, ratings })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'analyst_ratings_failed',
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

app.get('/api/insider-trading', requireAuth, async (req, res) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : ''
    const data = symbol ? await getInsiderForSymbol(symbol) : await getInsiderFeed()
    res.json({ ok: true, ...data })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'insider_trading_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/congressional-trading', requireAuth, async (req, res) => {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : ''
    const data = symbol ? await getCongressForSymbol(symbol) : await getCongressFeed()
    res.json({ ok: true, ...data })
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'congressional_trading_failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

app.get('/api/markets-heatmap', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 120
    const data = await getMarketHeatmap({ limit })
    res.json(data)
  } catch (err) {
    res.status(statusForProviderError(err)).json({
      ok: false,
      error: 'markets_heatmap_failed',
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

app.post('/api/alerts', requireAuth, async (req, res) => {
  const {
    symbol, condition, threshold, cooldown_minutes,
    min_volume_mult, time_window_minutes, buffer_pct, alert_type,
  } = req.body ?? {}

  // For earnings alerts, look up the next earnings date (and auto-detected
  // session, used only for notification wording) from FMP before insert.
  let earnings_date = null
  let earnings_eps_est = null
  let earnings_session = null
  if (condition === 'earnings_report') {
    try {
      const next = await fetchNextEarnings(symbol)
      if (!next) {
        res.status(400).json({
          ok: false,
          error: 'no_upcoming_earnings',
          message: 'No upcoming earnings date found for this symbol within 90 days.',
        })
        return
      }
      earnings_date = next.date
      earnings_eps_est = next.epsEstimated
      earnings_session = next.session
    } catch (err) {
      const status = statusForProviderError(err)
      res.status(status).json({
        ok: false,
        error: 'earnings_lookup_failed',
        message: err instanceof Error ? err.message : 'Failed to look up earnings date.',
      })
      return
    }
  }

  const result = createAlert(req.user.id, {
    symbol, condition, threshold, cooldown_minutes,
    min_volume_mult, time_window_minutes, buffer_pct, alert_type,
    earnings_date, earnings_session, earnings_eps_est,
  })
  if (!result.ok) {
    res.status(400).json({ ok: false, error: 'create_alert_failed', message: result.error })
    return
  }
  res.status(201).json({ ok: true, alert: result.alert })
})

app.post('/api/alerts/:id/dismiss-earnings-badge', requireAuth, (req, res) => {
  const alertId = Number(req.params.id)
  if (!Number.isFinite(alertId) || alertId <= 0) {
    res.status(400).json({ ok: false, error: 'bad_request', message: 'Invalid alert id.' })
    return
  }
  const result = dismissEarningsDateBadge(req.user.id, alertId)
  if (!result.ok) {
    res.status(404).json({ ok: false, error: 'not_found', message: 'Alert not found.' })
    return
  }
  res.json({ ok: true })
})

app.patch('/api/alerts/:id', requireAuth, (req, res) => {
  const alertId = Number(req.params.id)
  const body = req.body ?? {}

  if ('cooldown_minutes' in body) {
    const cd = Number(body.cooldown_minutes)
    if (!Number.isFinite(cd) || cd < 0) {
      res.status(400).json({ ok: false, error: 'bad_request', message: 'cooldown_minutes must be a non-negative number' })
      return
    }
    const result = updateAlertCooldown(req.user.id, alertId, cd)
    if (!result.ok) { res.status(404).json({ ok: false, error: 'not_found', message: result.error }); return }
    res.json({ ok: true })
    return
  }

  const { is_active } = body
  const result = toggleAlert(req.user.id, alertId, Boolean(is_active))
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

app.post('/api/alerts/reactivate-all', requireAuth, (req, res) => {
  const result = reactivateAllAlerts(req.user.id)
  res.json(result)
})


app.get('/api/alerts/history-chart/:symbol', requireAuth, async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase().trim()
    const atUnix = Number(req.query.at)
    if (!sym || sym.length > 12 || !Number.isFinite(atUnix) || atUnix <= 0) {
      res.status(400).json({ ok: false, message: 'symbol and at (unix timestamp) are required' })
      return
    }
    const triggerDate = new Date(atUnix * 1000)
    const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(triggerDate)

    const allBars = await fetchBarsForDate(sym, etDate)
    if (allBars.length === 0) {
      res.json({ ok: true, symbol: sym, bars: [], noData: true })
      return
    }

    // Compute running VWAP from session open
    let sumPV = 0, sumV = 0
    const enriched = allBars.map((b) => {
      const h = Number(b.high ?? b.close), l = Number(b.low ?? b.close), c = Number(b.close)
      const vol = Math.max(Number(b.volume) || 1, 1)
      sumPV += ((h + l + c) / 3) * vol
      sumV += vol
      return {
        time: b.date,
        price: Math.round(c * 100) / 100,
        vwap: Math.round((sumV > 0 ? sumPV / sumV : c) * 100) / 100,
      }
    })

    // Filter to ±30 minutes around the trigger time
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const tParts = fmt.formatToParts(triggerDate)
    const triggerMins =
      Number(tParts.find((p) => p.type === 'hour')?.value ?? 0) * 60 +
      Number(tParts.find((p) => p.type === 'minute')?.value ?? 0)

    const windowBars = enriched.filter((b) => {
      const timePart = b.time.split(' ')[1] ?? ''
      const [hh, mm] = timePart.split(':').map(Number)
      return Math.abs((hh * 60 + mm) - triggerMins) <= 30
    })

    res.json({ ok: true, symbol: sym, bars: windowBars, triggeredAt: atUnix })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/alerts/vwap-chart/:symbol', requireAuth, async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase().trim()
    if (!sym || sym.length > 12) {
      res.status(400).json({ ok: false, message: 'Invalid symbol' })
      return
    }
    const bars = await fetchTodayBars(sym)

    // Compute session-anchored running VWAP (accumulates from open, show last 30 bars)
    let sumPV = 0, sumV = 0
    const enriched = bars.map((b) => {
      const h = Number(b.high ?? b.close)
      const l = Number(b.low ?? b.close)
      const c = Number(b.close)
      const vol = Math.max(Number(b.volume) || 1, 1)
      sumPV += ((h + l + c) / 3) * vol
      sumV += vol
      return {
        time: b.date,
        price: Math.round(c * 100) / 100,
        vwap: Math.round((sumV > 0 ? sumPV / sumV : c) * 100) / 100,
      }
    })

    res.json({ ok: true, symbol: sym, bars: enriched.slice(-90) })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.get('/api/alerts/history', requireAuth, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50)
  res.json({ ok: true, history: getAlertHistoryByUser(req.user.id, limit) })
})

/** Manual alert-engine tick for local testing (`NODE_ENV=development` or `ALERTS_DEBUG_ENDPOINT=1` or `ALERTS_SIMULATION_ENABLED=1`). */
app.post('/api/alerts/run-check-once', requireAuth, async (_req, res) => {
  if (!alertTestRoutesEnabled()) {
    res.status(404).json({
      ok: false,
      error: 'not_found',
      message:
        'Set ALERTS_SIMULATION_ENABLED=1 (or ALERTS_DEBUG_ENDPOINT=1) in server/.env, or run with NODE_ENV=development.',
    })
    return
  }
  try {
    await runAlertCheck()
    res.json({ ok: true, message: 'Alert engine tick finished (fires only when conditions match FMP quotes).' })
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
  }
})

/** Simulate an alert_fired push (tests WebSocket + browser banner). */
app.post('/api/alerts/simulate-fire', requireAuth, (req, res) => {
  if (!alertTestRoutesEnabled()) {
    res.status(404).json({
      ok: false,
      error: 'not_found',
      message:
        'Set ALERTS_SIMULATION_ENABLED=1 (or ALERTS_DEBUG_ENDPOINT=1) in server/.env, or run with NODE_ENV=development.',
    })
    return
  }
  const { symbol, condition, threshold } = req.body ?? {}
  const sym = String(symbol ?? 'SPY').trim().toUpperCase()
  const payload = {
    type: 'alert_fired',
    alertId: 0,
    symbol: sym || 'SPY',
    condition: String(condition ?? 'price_above'),
    threshold: threshold ?? 0,
    triggeredPrice: Number(req.body?.triggeredPrice ?? 0) || 0,
    vwapAtTrigger: null,
    triggeredAt: Math.floor(Date.now() / 1000),
    simulated: true,
  }
  const delivered = broadcastToUser(req.user.id, payload)
  res.json({ ok: true, delivered, payload })
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
    `[server] FMP batch-aftermarket merge outside US RTH: ${
      String(process.env.FMP_MERGE_AFTERMARKET_QUOTES ?? '1').trim() !== '0' ? 'on' : 'off'
    } (set FMP_MERGE_AFTERMARKET_QUOTES=0 to disable)`,
  )
  console.log(
    `[server] Backtests → ${process.env.BACKTEST_SERVICE_URL?.trim() || 'http://127.0.0.1:8765'} (vectorbt / vectorbtpro)`,
  )
  startAlertEngine()
  startCleanupJobs()
})
