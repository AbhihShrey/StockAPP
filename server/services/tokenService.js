import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import db from '../db.js'

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000 // 1 hour
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const SALT_ROUNDS = 10

function publicBaseUrl() {
  const u = process.env.PUBLIC_BASE_URL?.trim()
  if (u) return u.replace(/\/+$/, '')
  return 'http://localhost:5173'
}

function newRawToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function timingSafeEq(a, b) {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

// ── Password reset ────────────────────────────────────────────────────────

export function createPasswordResetTokenForEmail(rawEmail) {
  const em = String(rawEmail ?? '').trim().toLowerCase()
  if (!em) return null
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(em)
  if (!user) return null
  const raw = newRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = Math.floor((Date.now() + PASSWORD_RESET_TTL_MS) / 1000)
  // Invalidate any prior unused tokens for this user.
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL').run(user.id)
  db.prepare(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
  ).run(user.id, tokenHash, expiresAt)
  return {
    user,
    raw,
    resetUrl: `${publicBaseUrl()}/reset-password?token=${raw}`,
    expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000),
  }
}

export async function consumePasswordResetToken(rawToken, newPassword) {
  if (!rawToken || typeof rawToken !== 'string') return { ok: false, error: 'Invalid or expired link.' }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  const candidate = hashToken(rawToken)
  const now = Math.floor(Date.now() / 1000)
  // Look up by exact hash (it's unique). Compare with timingSafeEqual for defense-in-depth.
  const row = db
    .prepare(
      'SELECT id, user_id, token_hash, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
    )
    .get(candidate)
  if (!row || !timingSafeEq(row.token_hash, candidate)) {
    return { ok: false, error: 'Invalid or expired link.' }
  }
  if (row.used_at) return { ok: false, error: 'This link has already been used.' }
  if (row.expires_at < now) return { ok: false, error: 'This link has expired. Request a new one.' }
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  const tx = db.transaction((userId, tokenId) => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, tokenId)
  })
  tx(row.user_id, row.id)
  return { ok: true }
}

// ── Email verification ────────────────────────────────────────────────────

export function createEmailVerifyToken(userId, email) {
  const raw = newRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = Math.floor((Date.now() + EMAIL_VERIFY_TTL_MS) / 1000)
  db.prepare(
    'DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL',
  ).run(userId)
  db.prepare(
    'INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  ).run(userId, email, tokenHash, expiresAt)
  return {
    raw,
    verifyUrl: `${publicBaseUrl()}/verify-email?token=${raw}`,
    expiresInMinutes: Math.round(EMAIL_VERIFY_TTL_MS / 60_000),
  }
}

export function consumeEmailVerifyToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return { ok: false, error: 'Invalid or expired link.' }
  const candidate = hashToken(rawToken)
  const now = Math.floor(Date.now() / 1000)
  const row = db
    .prepare(
      'SELECT id, user_id, email, token_hash, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?',
    )
    .get(candidate)
  if (!row || !timingSafeEq(row.token_hash, candidate)) {
    return { ok: false, error: 'Invalid or expired link.' }
  }
  if (row.used_at) return { ok: false, error: 'This link has already been used.' }
  if (row.expires_at < now) return { ok: false, error: 'This link has expired.' }
  const tx = db.transaction((userId, tokenId) => {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId)
    db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').run(now, tokenId)
  })
  tx(row.user_id, row.id)
  return { ok: true, userId: row.user_id, email: row.email }
}

// ── Pruning ───────────────────────────────────────────────────────────────

export function pruneExpiredTokens() {
  const now = Math.floor(Date.now() / 1000)
  const a = db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(now)
  const b = db.prepare('DELETE FROM email_verification_tokens WHERE expires_at < ?').run(now)
  return { passwordResetDeleted: a.changes, emailVerifyDeleted: b.changes }
}
