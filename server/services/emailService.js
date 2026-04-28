import nodemailer from 'nodemailer'

function buildTransporter() {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  })
}

export function isEmailConfigured() {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  return Boolean(host && user && pass)
}

/**
 * Build the RFC-5322 "From" header. Display name defaults to "Ember Finances" so the
 * inbox shows "Ember Finances <…>" instead of the raw Brevo bounce alias.
 * Override with SMTP_FROM_NAME and/or SMTP_FROM in server/.env.
 */
function buildFromHeader() {
  const rawFrom = process.env.SMTP_FROM?.trim()
  const addressOnly = rawFrom || process.env.SMTP_USER?.trim() || ''
  if (rawFrom && /<[^>]+>/.test(rawFrom)) return rawFrom
  const name = process.env.SMTP_FROM_NAME?.trim() || 'Ember Finances'
  return `"${name.replace(/"/g, '')}" <${addressOnly}>`
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function pctColor(n) {
  if (n == null || !Number.isFinite(Number(n))) return '#a1a1aa'
  const v = Number(n)
  if (v > 0) return '#34d399'
  if (v < 0) return '#f87171'
  return '#a1a1aa'
}

function pctStr(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function priceStr(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n))
}

function etDateLabel() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date())
}

function etTimeLabel(d = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d) + ' ET'
}

function conditionLabel(condition, threshold) {
  switch (condition) {
    case 'vwap_above': return 'crossed above VWAP'
    case 'vwap_below': return 'crossed below VWAP'
    case 'price_above': return `crossed above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `crossed below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `crossed above Opening Range High (${threshold}min)`
    case 'orhl_below': return `crossed below Opening Range Low (${threshold}min)`
    default: return condition
  }
}

// ── Shared email shell ─────────────────────────────────────────────────────

function emailShell({ title, subtitle, body, footer }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 16px;background:#050505">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;border-radius:14px;overflow:hidden;border:1px solid #1c1c1c">
  <div style="background:linear-gradient(135deg,#0f0f0f 0%,#0a120e 100%);border-bottom:1px solid #1c1c1c;padding:22px 26px">
    <table cellpadding="0" cellspacing="0" style="width:100%"><tr>
      <td style="vertical-align:middle">
        <span style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:7px;background:#0a0a0a;text-align:center;line-height:0">
          <svg width="20" height="20" viewBox="0 0 30 30" style="vertical-align:middle;margin-top:4px">
            <path d="M 15 4 C 18 9, 22 13, 22 18 C 22 23, 18 26, 15 26 C 12 26, 8 23, 8 18 C 8 14, 12 11, 14 7 Z" fill="#c2421e"/>
            <path d="M 15 9 C 18 13, 20 16, 20 20 C 20 24, 17 25, 15 25 C 13 25, 10 24, 10 20 C 10 16, 12 13, 14 10 Z" fill="#ff8a3d"/>
            <path d="M 15 14 C 17 16, 18 19, 17 22 C 16 24, 14 24, 13 22 C 12 19, 13 17, 15 14 Z" fill="#ffe0a8"/>
          </svg>
        </span>
        <span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:700;color:#e4e4e7;letter-spacing:-0.3px">Ember Finances</span>
      </td>
      <td style="text-align:right;vertical-align:middle;font-size:11px;color:#52525b">${subtitle ?? ''}</td>
    </tr></table>
    ${title ? `<div style="margin-top:12px;font-size:15px;font-weight:600;color:#e4e4e7">${title}</div>` : ''}
  </div>
  ${body}
  <div style="padding:18px 26px;border-top:1px solid #1c1c1c;background:#080808">
    <p style="margin:0;font-size:11px;color:#3f3f46;line-height:1.5">${footer}</p>
  </div>
</div>
</body>
</html>`
}

function sectionHeader(label) {
  return `<div style="padding:22px 26px 6px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#52525b">${label}</div></div>`
}

function rowTable(rows) {
  return `<div style="padding:0 26px"><table style="width:100%;border-collapse:collapse">${rows}</table></div>`
}

function simpleRow({ left, middle, right, rightColor = '#a1a1aa' }) {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #161616;font-weight:600;color:#f4f4f5;font-size:13px">${left}</td>
    <td style="padding:7px 0;border-bottom:1px solid #161616;text-align:right;font-size:13px;color:#a1a1aa">${middle ?? ''}</td>
    <td style="padding:7px 0;border-bottom:1px solid #161616;text-align:right;font-weight:600;font-size:13px;color:${rightColor}">${right ?? ''}</td>
  </tr>`
}

// ── Alert fired email ──────────────────────────────────────────────────────

export async function sendAlertEmail(toEmail, { symbol, condition, threshold, triggeredPrice, vwapAtTrigger }) {
  const transporter = buildTransporter()
  if (!transporter) return

  const label = conditionLabel(condition, threshold)
  const subject = `${symbol} ${label}`

  const body = `
  <div style="padding:24px 26px 8px">
    <div style="font-size:11px;color:#52525b;margin-bottom:6px">${etTimeLabel()}</div>
    <div style="font-size:22px;font-weight:700;color:#34d399;letter-spacing:-0.3px">${symbol}</div>
    <div style="margin-top:4px;font-size:14px;color:#e4e4e7">${label}</div>
  </div>
  <div style="padding:12px 26px 22px">
    <div style="display:inline-block;padding:10px 14px;border-radius:10px;background:#0f0f0f;border:1px solid #1c1c1c;min-width:120px">
      <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.08em">Price</div>
      <div style="font-size:17px;font-weight:700;color:#f4f4f5;margin-top:2px">${priceStr(triggeredPrice)}</div>
    </div>
    ${vwapAtTrigger != null ? `
    <div style="display:inline-block;padding:10px 14px;border-radius:10px;background:#0f0f0f;border:1px solid #1c1c1c;min-width:120px;margin-left:6px">
      <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.08em">VWAP</div>
      <div style="font-size:17px;font-weight:700;color:#f4f4f5;margin-top:2px">${priceStr(vwapAtTrigger)}</div>
    </div>` : ''}
  </div>`

  try {
    await transporter.sendMail({
      from: buildFromHeader(),
      to: toEmail,
      subject,
      html: emailShell({
        title: `Alert fired`,
        subtitle: etTimeLabel(),
        body,
        footer: `You received this because email alerts are enabled on your Ember Finances account. Manage alerts in <strong style="color:#71717a">Settings → Notifications</strong>.`,
      }),
    })
  } catch (err) {
    console.error('[email] Failed to send alert email:', err.message)
  }
}

// ── Daily digest email ─────────────────────────────────────────────────────

/**
 * Send the daily close digest.
 * @param {string} toEmail
 * @param {{
 *   marketSummary?: Array<{symbol,price,changePercent}>,
 *   sectorSummary?: Array<{symbol,name,changePercent}>,
 *   breadth?: { pctAbove200d?: number|null, advancers?: number|null, decliners?: number|null, newHighs?: number|null, newLows?: number|null },
 *   topMovers?: { gainers?: Array, losers?: Array },
 *   watchlistMovers?: Array<{symbol,price,changePercent}>,
 *   alertsFired?: Array,
 *   upcomingEvents?: Array<{time,title,importance,country}>,
 * }} data
 */
export async function sendDailyDigestEmail(toEmail, data = {}) {
  const transporter = buildTransporter()
  if (!transporter) return

  const {
    marketSummary = [],
    sectorSummary = [],
    breadth = {},
    topMovers = {},
    watchlistMovers = [],
    alertsFired = [],
    upcomingEvents = [],
  } = data

  const dateLabel = etDateLabel()
  const subject = `Ember Finances Daily Close — ${dateLabel}`

  const marketRows = marketSummary.length === 0
    ? `<tr><td colspan="3" style="padding:8px 0;font-size:12px;color:#52525b">Market data unavailable.</td></tr>`
    : marketSummary.map((s) => simpleRow({
      left: s.symbol,
      middle: priceStr(s.price),
      right: pctStr(s.changePercent),
      rightColor: pctColor(s.changePercent),
    })).join('')

  const sectorRows = sectorSummary.length === 0
    ? `<tr><td colspan="3" style="padding:8px 0;font-size:12px;color:#52525b">No sector data.</td></tr>`
    : sectorSummary.slice(0, 11).map((s) => simpleRow({
      left: s.symbol,
      middle: `<span style="color:#71717a">${s.name ?? ''}</span>`,
      right: pctStr(s.changePercent),
      rightColor: pctColor(s.changePercent),
    })).join('')

  const breadthCards = (() => {
    const cell = (label, value, color = '#e4e4e7') => `
      <td style="padding:10px 12px;border:1px solid #1c1c1c;border-radius:10px;background:#0f0f0f;vertical-align:top;width:25%">
        <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.08em">${label}</div>
        <div style="font-size:15px;font-weight:700;color:${color};margin-top:3px">${value}</div>
      </td>`
    return `<div style="padding:8px 26px 0"><table cellpadding="0" cellspacing="6" style="width:100%;border-collapse:separate"><tr>
      ${cell('Above 200D', breadth.pctAbove200d != null ? `${breadth.pctAbove200d.toFixed(0)}%` : '—')}
      ${cell('Advancers', breadth.advancers ?? '—', '#34d399')}
      ${cell('Decliners', breadth.decliners ?? '—', '#f87171')}
      ${cell('New 52W H/L', `${breadth.newHighs ?? '—'} / ${breadth.newLows ?? '—'}`)}
    </tr></table></div>`
  })()

  const moversBlock = (() => {
    const list = (title, rows, colorFn) => {
      if (!rows || rows.length === 0) return ''
      const body = rows.slice(0, 5).map((m) => simpleRow({
        left: m.ticker ?? m.symbol,
        middle: priceStr(m.price),
        right: pctStr(m.changePercent),
        rightColor: colorFn(m.changePercent),
      })).join('')
      return `
        <div style="padding:4px 26px 4px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#52525b;margin:8px 0 4px">${title}</div><table style="width:100%;border-collapse:collapse">${body}</table></div>`
    }
    return list('Top gainers', topMovers.gainers, pctColor) + list('Top losers', topMovers.losers, pctColor)
  })()

  const wlBlock = watchlistMovers.length === 0
    ? `<div style="padding:4px 26px 10px"><p style="margin:0;font-size:12px;color:#52525b">No significant moves on your watchlist today.</p></div>`
    : rowTable(watchlistMovers.map((s) => simpleRow({
      left: s.symbol,
      middle: priceStr(s.price),
      right: pctStr(s.changePercent),
      rightColor: pctColor(s.changePercent),
    })).join(''))

  const alertBlock = alertsFired.length === 0
    ? `<div style="padding:4px 26px 10px"><p style="margin:0;font-size:12px;color:#52525b">No alerts fired in the last 24 hours.</p></div>`
    : `<div style="padding:4px 26px">${alertsFired.slice(0, 12).map((a) => `
      <div style="padding:8px 0;border-bottom:1px solid #161616">
        <span style="font-size:13px;font-weight:700;color:#34d399">${a.symbol}</span>
        <span style="font-size:13px;color:#e4e4e7"> ${conditionLabel(a.condition, a.threshold)}</span>
        <span style="font-size:12px;color:#a1a1aa"> · ${priceStr(a.triggered_price ?? a.triggeredPrice)}</span>
      </div>`).join('')}</div>`

  const eventsBlock = upcomingEvents.length === 0
    ? `<div style="padding:4px 26px 18px"><p style="margin:0;font-size:12px;color:#52525b">No major events on the calendar.</p></div>`
    : `<div style="padding:4px 26px 18px">${upcomingEvents.slice(0, 6).map((e) => `
      <div style="padding:8px 0;border-bottom:1px solid #161616">
        <span style="font-size:11px;color:#71717a;display:inline-block;width:90px">${e.time ?? '—'}</span>
        <span style="font-size:13px;color:#e4e4e7;font-weight:600">${e.title ?? ''}</span>
        <span style="font-size:11px;color:${e.importance === 'high' ? '#fbbf24' : '#52525b'};margin-left:6px">${e.importance ? e.importance.toUpperCase() : ''}</span>
        ${e.country ? `<span style="font-size:11px;color:#52525b;margin-left:6px">${e.country}</span>` : ''}
      </div>`).join('')}</div>`

  const body = `
  ${sectionHeader('Index close')}
  ${rowTable(marketRows)}
  ${sectionHeader('Market breadth')}
  ${breadthCards}
  ${sectionHeader('Sectors today')}
  ${rowTable(sectorRows)}
  ${sectionHeader('S&P movers')}
  ${moversBlock}
  ${sectionHeader('Your watchlist')}
  ${wlBlock}
  ${sectionHeader('Alerts fired today')}
  ${alertBlock}
  ${sectionHeader('Up next — calendar')}
  ${eventsBlock}`

  const html = emailShell({
    title: 'Daily close summary',
    subtitle: dateLabel,
    body,
    footer: `You received this because daily digest is enabled on your Ember Finances account. Manage preferences in <strong style="color:#71717a">Settings → Notifications</strong>.`,
  })

  try {
    await transporter.sendMail({ from: buildFromHeader(), to: toEmail, subject, html })
  } catch (err) {
    console.error('[email] Failed to send digest email:', err.message)
    throw err
  }
}

// ── Password reset email ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(toEmail, { resetUrl, expiresInMinutes = 60 }) {
  const transporter = buildTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping password reset email.')
    return
  }
  const body = `
  <div style="padding:26px">
    <div style="font-size:15px;color:#e4e4e7;line-height:1.55">We received a request to reset the password on your Ember Finances account.</div>
    <div style="margin-top:10px;font-size:13px;color:#a1a1aa;line-height:1.6">If this was you, click the button below within ${expiresInMinutes} minutes. If not, you can safely ignore this email — your password stays the same.</div>
    <div style="margin-top:22px">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:linear-gradient(135deg,#34d399,#10b981);color:#052e1c;font-weight:700;font-size:14px;text-decoration:none">Reset password</a>
    </div>
    <div style="margin-top:22px;font-size:11px;color:#52525b;line-height:1.55">If the button doesn't work, copy and paste this link:<br/><span style="color:#71717a;word-break:break-all">${resetUrl}</span></div>
  </div>`
  try {
    await transporter.sendMail({
      from: buildFromHeader(),
      to: toEmail,
      subject: 'Reset your Ember Finances password',
      html: emailShell({
        title: 'Password reset request',
        subtitle: etDateLabel(),
        body,
        footer: `If you did not request a password reset, you can ignore this message. The link expires in ${expiresInMinutes} minutes and can only be used once.`,
      }),
    })
  } catch (err) {
    console.error('[email] Failed to send password reset email:', err.message)
    throw err
  }
}

// ── Verify email ───────────────────────────────────────────────────────────

export async function sendVerifyEmail(toEmail, { verifyUrl, expiresInMinutes = 60 * 24 }) {
  const transporter = buildTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping verification email.')
    return
  }
  const body = `
  <div style="padding:26px">
    <div style="font-size:15px;color:#e4e4e7;line-height:1.55">Welcome to Ember Finances. Please confirm your email address to keep your account in good standing and unlock email-based alerts.</div>
    <div style="margin-top:22px">
      <a href="${verifyUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:linear-gradient(135deg,#34d399,#10b981);color:#052e1c;font-weight:700;font-size:14px;text-decoration:none">Verify email</a>
    </div>
    <div style="margin-top:22px;font-size:11px;color:#52525b;line-height:1.55">If the button doesn't work, copy and paste this link:<br/><span style="color:#71717a;word-break:break-all">${verifyUrl}</span></div>
  </div>`
  try {
    await transporter.sendMail({
      from: buildFromHeader(),
      to: toEmail,
      subject: 'Verify your Ember Finances email',
      html: emailShell({
        title: 'Confirm your email',
        subtitle: etDateLabel(),
        body,
        footer: `If you did not create a Ember Finances account, you can ignore this message. The link expires in ${Math.round(expiresInMinutes / 60)} hours.`,
      }),
    })
  } catch (err) {
    console.error('[email] Failed to send verification email:', err.message)
    throw err
  }
}

// ── Test email ─────────────────────────────────────────────────────────────

/** Returns only after send or throws. */
export async function sendTestEmail(toEmail) {
  const transporter = buildTransporter()
  if (!transporter) {
    const err = new Error('SMTP is not fully configured (need SMTP_HOST, SMTP_USER, SMTP_PASS).')
    err.code = 'SMTP_NOT_CONFIGURED'
    throw err
  }
  const from = buildFromHeader()
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  console.log(`[email] sending test to=${toEmail} from=${from} via ${host} as ${user}`)

  const body = `
  <div style="padding:26px">
    <div style="font-size:16px;color:#e4e4e7;line-height:1.55">SMTP delivery is working.</div>
    <div style="margin-top:10px;font-size:13px;color:#a1a1aa;line-height:1.55">You can now enable alert fire emails and the daily close digest under <strong style="color:#e4e4e7">Settings → Notifications</strong>.</div>
    <div style="margin-top:18px;display:inline-block;padding:10px 14px;border-radius:10px;background:#0f0f0f;border:1px solid #1c1c1c">
      <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:0.08em">Sent at</div>
      <div style="font-size:14px;font-weight:600;color:#f4f4f5;margin-top:3px">${etTimeLabel()}</div>
    </div>
  </div>`

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'Ember Finances: test email',
      text: 'Test email from Ember Finances — SMTP is working.',
      html: emailShell({
        title: 'Test email',
        subtitle: etDateLabel(),
        body,
        footer: `If you did not request this, you can safely ignore the message.`,
      }),
    })
    console.log(`[email] test send ok: messageId=${info.messageId} response=${info.response}`)
    return info
  } catch (err) {
    console.error('[email] test send FAILED:', {
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      message: err.message,
    })
    const wrapped = new Error(
      `SMTP error ${err.responseCode ?? err.code ?? ''}: ${err.response ?? err.message}`.trim(),
    )
    wrapped.code = err.code
    throw wrapped
  }
}
