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

export async function sendAlertEmail(toEmail, { symbol, condition, threshold, triggeredPrice, vwapAtTrigger }) {
  const transporter = buildTransporter()
  if (!transporter) return

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim()
  const label = conditionLabel(condition, threshold)
  const subject = `Alert: ${symbol} ${label}`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e4e4e7;border-radius:12px">
      <h2 style="margin:0 0 16px;color:#4ade80;font-size:18px">InvestAI Alert Fired</h2>
      <p style="margin:0 0 8px;font-size:15px"><strong style="color:#f4f4f5">${symbol}</strong> ${label}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">Triggered at: <strong style="color:#e4e4e7">$${Number(triggeredPrice).toFixed(2)}</strong></p>
      ${vwapAtTrigger != null ? `<p style="margin:0 0 4px;font-size:13px;color:#a1a1aa">VWAP: <strong style="color:#e4e4e7">$${Number(vwapAtTrigger).toFixed(2)}</strong></p>` : ''}
      <p style="margin:16px 0 0;font-size:11px;color:#52525b">You received this because email alerts are enabled on your account. To manage alerts, log into InvestAI.</p>
    </div>
  `

  try {
    await transporter.sendMail({ from, to: toEmail, subject, html })
  } catch (err) {
    console.error('[email] Failed to send alert email:', err.message)
  }
}
