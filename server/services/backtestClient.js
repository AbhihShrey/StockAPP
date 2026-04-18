const DEFAULT_URL = 'http://127.0.0.1:8765'

function backtestBaseUrl() {
  const u = process.env.BACKTEST_SERVICE_URL?.trim()
  return u || DEFAULT_URL
}

function mapFetchError(err) {
  const e = new Error(
    err?.cause?.code === 'ECONNREFUSED' || err?.code === 'ECONNREFUSED'
      ? 'Backtest service is not running. From repo root: npm run dev:backtest (venv) or npm run dev:backtest:conda (Conda env vbt)'
      : err instanceof Error
        ? err.message
        : 'Backtest request failed',
  )
  e.code = 'BACKTEST_UNAVAILABLE'
  return e
}

/**
 * @returns {Promise<{ strategies: Array<{ id: string, label: string, description: string }> }>}
 */
export async function fetchBacktestStrategies() {
  const url = `${backtestBaseUrl()}/strategies`
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (err) {
    throw mapFetchError(err)
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const e = new Error(json?.detail ?? json?.message ?? `Backtest service HTTP ${res.status}`)
    e.code = 'BACKTEST_UNAVAILABLE'
    throw e
  }
  return json
}

/**
 * @param {{ symbol: string, strategyId: string, start?: string|null, end?: string|null, params?: Record<string, unknown> }} body
 */
export async function runBacktest(body) {
  const url = `${backtestBaseUrl()}/backtest`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: body.symbol,
        strategyId: body.strategyId,
        start: body.start ?? undefined,
        end: body.end ?? undefined,
        params: body.params ?? undefined,
      }),
    })
  } catch (err) {
    throw mapFetchError(err)
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const detail =
      typeof json?.detail === 'string'
        ? json.detail
        : Array.isArray(json?.detail)
          ? json.detail.map((d) => d.msg ?? d).join('; ')
          : json?.message
    const e = new Error(detail ?? `Backtest failed (${res.status})`)
    e.code = res.status === 400 ? 'BACKTEST_BAD_REQUEST' : 'BACKTEST_UNAVAILABLE'
    throw e
  }
  return json
}
