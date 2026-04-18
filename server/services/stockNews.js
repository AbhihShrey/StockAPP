/**
 * FMP stable stock / crypto / symbol news + snapshot for News page master-detail.
 * @see https://site.financialmodelingprep.com/developer/docs/stable/stock-news
 */
import { fetchBatchQuotesBySymbols, fetchHistoricalEodLight, fmpGet } from './fmp.js'

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(
    String(value)
      .replace(/[%,$\s]/g, '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

function sparklineFromLight(rows, maxPoints = 48) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const slice = rows.slice(0, Math.min(maxPoints, rows.length))
  const closes = slice
    .map((r) => toNumber(r.price ?? r.close ?? r.adjClose))
    .filter((n) => n != null && Number.isFinite(n))
  return closes.reverse()
}

const EARNINGS_RE =
  /\b(earnings|EPS|quarter|Q[1-4]\b|guidance|revenue|top\s*line|bottom\s*line|beat\s+estimates?|miss(es)?\s+estimates?|conference\s+call|EBITDA|net\s+income)\b/i
const MA_RE =
  /\b(merger|acquisition|acquires?|buyout|takeover|M&A|to\s+buy|to\s+acquire|acquired|agrees\s+to\s+buy|purchase\s+agreement)\b/i

function matchesEarnings(row) {
  const t = `${row.title ?? ''} ${row.text ?? ''} ${row.description ?? ''}`
  return EARNINGS_RE.test(t)
}

function matchesMa(row) {
  const t = `${row.title ?? ''} ${row.text ?? ''} ${row.description ?? ''}`
  return MA_RE.test(t)
}

/** Map numeric sentiment to roughly -1 … +1. */
function scaleSentimentNumber(n) {
  if (!Number.isFinite(n)) return null
  if (n >= -1 && n <= 1) return n
  if (n >= 0 && n <= 100) return n / 50 - 1
  return Math.max(-1, Math.min(1, n / 100))
}

/** Parse label-ish strings some feeds use instead of numbers. */
function sentimentFromLabel(s) {
  if (typeof s !== 'string') return null
  const low = s.trim().toLowerCase()
  if (!low) return null
  if (/\b(very\s+)?(bull|positive|optimistic|buy)\b/.test(low)) return 0.55
  if (/\b(slightly|mildly)\s+(bull|positive)\b/.test(low)) return 0.25
  if (/\b(very\s+)?(bear|negative|pessimistic|sell)\b/.test(low)) return -0.55
  if (/\b(slightly|mildly)\s+(bear|negative)\b/.test(low)) return -0.25
  if (/\bneutral\b/.test(low)) return 0
  return null
}

/**
 * FMP feeds vary: stock-latest often omits sentiment; other bundles may use different keys.
 * Returns a number in [-1, 1] or null if nothing parseable.
 */
function extractFmpSentiment(raw) {
  const tryNum = (v) => {
    if (v == null || v === '') return null
    if (typeof v === 'number') return scaleSentimentNumber(v)
    if (typeof v === 'string') {
      const n = Number(String(v).replace(/[%,$\s]/g, '').trim())
      if (Number.isFinite(n)) return scaleSentimentNumber(n)
      return sentimentFromLabel(v)
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const key of ['score', 'value', 'sentiment', 'sentimentScore', 'polarity', 'label', 'sentimentLabel']) {
        const inner = v[key]
        if (inner == null || inner === v) continue
        const n = tryNum(inner)
        if (n != null && Number.isFinite(n)) return n
      }
    }
    return null
  }

  const bull = toNumber(raw.bullishPercent ?? raw.bullish ?? raw.bullishScore)
  const bear = toNumber(raw.bearishPercent ?? raw.bearish ?? raw.bearishScore)
  if (bull != null && bear != null && bull >= 0 && bear >= 0) {
    return Math.max(-1, Math.min(1, (bull - bear) / 100))
  }

  const candidates = [
    raw.sentiment,
    raw.sentimentScore,
    raw.stockSentiment,
    raw.sentimentPolarity,
    raw.sentimentScoreValue,
    raw.textSentiment,
    raw.textSentimentScore,
    raw.newsSentiment,
    raw.overallSentiment,
    raw.overall_sentiment,
    raw.sentimentAnalysis,
    raw.sentiment_label,
    raw.sentimentLabel,
    raw.score,
    raw.polarity,
  ]

  for (const c of candidates) {
    const n = tryNum(c)
    if (n != null && Number.isFinite(n)) return n
  }

  return null
}

/** Lightweight headline/body tilt when FMP does not attach a model score (very common on /news/stock-latest). */
const LEX_POS = [
  /\bsurge[ds]?\b/i,
  /\bsoar(s|ed|ing)?\b/i,
  /\brall(y|ies|ied|ying)\b/i,
  /\brocket(s|ed|ing)?\b/i,
  /\bbeat(s|ing)?\s+(the\s+)?(street|estimates|expectations)\b/i,
  /\bearnings\s+beat\b/i,
  /\b(?:profit|revenue)\s+(jump|surge|soar|growth|rose|climb)/i,
  /\b(?:strong|solid|robust)\s+(quarter|results|guidance|demand|growth)\b/i,
  /\b(?:raises?|raised|raising)\s+(guidance|outlook|forecast)\b/i,
  /\boutperform(s|ed|ing)?\b/i,
  /\bbullish\b/i,
  /\bupgrade[ds]?\b/i,
  /\bbuyback(s)?\b/i,
  /\brecord\s+(high|profit|revenue|close)\b/i,
  /\b(?:tops?|topped|topping)\s+estimates\b/i,
  /\bgains?\s+\d+/i,
  /\bpositive\s+(outlook|guidance|momentum)\b/i,
]

const LEX_NEG = [
  /\bplunge[ds]?\b/i,
  /\btumble[ds]?\b/i,
  /\bslump(s|ed|ing)?\b/i,
  /\bcrash(es|ed|ing)?\b/i,
  /\bmiss(es|ed|ing)?\s+(on\s+)?(earnings|revenue|estimates|expectations)\b/i,
  /\b(?:cut|cuts|cutting)\s+(guidance|forecast|jobs|workforce|outlook)\b/i,
  /\b(?:weak|weaker)\s+(guidance|demand|outlook|results|sales)\b/i,
  /\bdowngrade[ds]?\b/i,
  /\bbearish\b/i,
  /\b(?:lawsuit|investigation|probe|scandal)\b/i,
  /\bbankrupt(cy|ed)?\b/i,
  /\b(?:layoff|layoffs|job\s+cuts?)\b/i,
  /\b(?:selloff|sell-off)\b/i,
  /\b(?:warning|warns)\b/i,
  /\bunderperform(s|ed|ing)?\b/i,
  /\bdecline[ds]?\b/i,
  /\b(?:falls?|fell|sinks?|sank)\s+\d+/i,
]

function inferLexiconSentiment(title, text) {
  const blob = `${title ?? ''} ${text ?? ''}`.trim()
  if (!blob) return null
  let pos = 0
  for (const re of LEX_POS) {
    if (re.test(blob)) pos += 1
  }
  let neg = 0
  for (const re of LEX_NEG) {
    if (re.test(blob)) neg += 1
  }
  if (pos === 0 && neg === 0) return 0
  const net = pos - neg
  return Math.max(-1, Math.min(1, net / 2.5))
}

function parseTickers(raw) {
  const out = new Set()
  if (Array.isArray(raw.tickers)) {
    for (const t of raw.tickers) {
      const s = String(t ?? '')
        .trim()
        .toUpperCase()
      if (s && /^[A-Z0-9.-]+$/.test(s)) out.add(s)
    }
  }
  const one = String(raw.symbol ?? '')
    .trim()
    .toUpperCase()
  if (one && /^[A-Z0-9.-]+$/.test(one)) out.add(one)
  const ts = raw.tickersString ?? raw.stockTickers ?? raw.stocks
  if (typeof ts === 'string') {
    for (const part of ts.split(/[,;/]/)) {
      const s = part.trim().toUpperCase()
      if (s && /^[A-Z0-9.-]+$/.test(s)) out.add(s)
    }
  }
  return [...out]
}

function articleKey(raw, index) {
  const url = String(raw.url ?? raw.link ?? '')
  const t = String(raw.publishedDate ?? raw.date ?? raw.pubDate ?? '')
  const title = String(raw.title ?? '')
  const base = `${url}|${t}|${title}`
  let h = 0
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0
  return `n-${Math.abs(h)}-${index}`
}

function normalizeArticle(raw, index) {
  const title = String(raw.title ?? '').trim() || 'Untitled'
  const text = String(raw.text ?? raw.description ?? raw.content ?? '').trim()
  const publishedDate = String(raw.publishedDate ?? raw.date ?? raw.pubDate ?? '').trim()
  const site = String(raw.site ?? raw.source ?? raw.publisher ?? '').trim() || '—'
  const url = String(raw.url ?? raw.link ?? '').trim()
  const image = String(raw.image ?? raw.imageUrl ?? '').trim() || null
  const fmpSent = extractFmpSentiment(raw)
  let sentiment = fmpSent
  let sentimentSource = fmpSent != null ? 'fmp' : null
  if (sentiment == null) {
    const inferred = inferLexiconSentiment(title, text)
    if (inferred != null) {
      sentiment = inferred
      sentimentSource = 'lexicon'
    }
  }
  const tickers = parseTickers(raw)
  return {
    id: articleKey(raw, index),
    title,
    text,
    publishedDate,
    site,
    url,
    image,
    sentiment,
    sentimentSource,
    tickers,
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {Record<string, string | undefined>} query
 */
export async function getStockNewsFeed(query) {
  const category = String(query.category ?? 'all').toLowerCase()
  const symbol = String(query.symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
  let from = String(query.from ?? '').trim()
  const to = String(query.to ?? '').trim() || todayISO()
  const page = Math.max(0, Math.min(500, parseInt(String(query.page ?? '0'), 10) || 0))
  let limit = Math.min(100, Math.max(5, parseInt(String(query.limit ?? '40'), 10) || 40))
  if (!symbol && (category === 'earnings' || category === 'ma')) {
    limit = Math.min(100, Math.max(limit, 80))
  }

  if (!from) {
    from = addDays(to, -30)
  }

  let fmpRows = []
  if (symbol) {
    const params = { symbols: symbol, page, limit }
    if (from) params.from = from
    if (to) params.to = to
    const data = await fmpGet('/news/stock', params)
    fmpRows = Array.isArray(data) ? data : []
  } else {
    const params = { page, limit }
    if (from) params.from = from
    if (to) params.to = to

    let path = '/news/stock-latest'
    if (category === 'crypto') path = '/news/crypto-latest'
    else if (category === 'general') path = '/news/general-latest'

    const data = await fmpGet(path, params)
    fmpRows = Array.isArray(data) ? data : []
  }

  let rows = fmpRows
  if (!symbol) {
    if (category === 'earnings') {
      rows = fmpRows.filter(matchesEarnings)
    } else if (category === 'ma') {
      rows = fmpRows.filter(matchesMa)
    }
  }

  const articles = rows.map((r, i) => normalizeArticle(r, i))
  return {
    source: 'fmp',
    symbol: symbol || null,
    from,
    to,
    page,
    limit,
    articles,
  }
}

/**
 * Quote + EOD sparkline for filtered ticker (detail pane).
 * @param {string} symbol
 */
export async function getStockNewsSnapshot(symbol) {
  const sym = String(symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
  if (!sym || sym.length > 12) {
    const err = new Error('Invalid symbol')
    err.code = 'BAD_REQUEST'
    throw err
  }

  const [light, quoteMap] = await Promise.all([
    fetchHistoricalEodLight(sym),
    fetchBatchQuotesBySymbols([sym]),
  ])

  const q = quoteMap.get(sym)
  const sparkline = sparklineFromLight(light, 48)

  return {
    symbol: sym,
    price: q?.price ?? null,
    change: q?.change ?? null,
    changePercent: q?.changePercent ?? null,
    volume: q?.volume ?? null,
    avgVolume: q?.avgVolume ?? null,
    sparkline,
  }
}
