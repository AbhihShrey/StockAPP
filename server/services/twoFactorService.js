import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as OTPAuth from 'otpauth'
import db from '../db.js'

const ISSUER = 'Ember Finances'
const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 10 // hex chars
const SALT_ROUNDS = 10
const TOKEN_TTL = '7d'
const CHALLENGE_TTL_SECONDS = 10 * 60

function jwtSecret() {
  const s = process.env.JWT_SECRET?.trim()
  if (!s) throw new Error('JWT_SECRET env var is not set')
  return s
}

function totpFromSecret(secret) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
}

function buildOtpauthUri(email, secret) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).toString()
}

function generateBackupCodes(n = BACKUP_CODE_COUNT) {
  const codes = []
  for (let i = 0; i < n; i++) {
    codes.push(crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex'))
  }
  return codes
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((c) => bcrypt.hash(c, SALT_ROUNDS)))
}

export function getTwoFactorStatus(userId) {
  const row = db
    .prepare('SELECT enabled FROM totp_secrets WHERE user_id = ?')
    .get(userId)
  return { enabled: Boolean(row?.enabled) }
}

/**
 * Provision a fresh secret + backup codes for the user (replaces any unverified prior setup).
 * Returns the otpauth URI (for QR rendering on the client) and the plaintext backup codes
 * (one-time display — they are stored hashed).
 */
export function setupTwoFactor(userId, userEmail) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32
  const backupCodes = generateBackupCodes()
  return hashBackupCodes(backupCodes).then((hashed) => {
    db.prepare(
      `INSERT INTO totp_secrets (user_id, secret, backup_codes_json, enabled)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(user_id) DO UPDATE SET secret = excluded.secret,
                                          backup_codes_json = excluded.backup_codes_json,
                                          enabled = 0`,
    ).run(userId, secret, JSON.stringify(hashed))
    return {
      otpauthUri: buildOtpauthUri(userEmail, secret),
      backupCodes,
    }
  })
}

export function enableTwoFactor(userId, code) {
  const row = db
    .prepare('SELECT secret, enabled FROM totp_secrets WHERE user_id = ?')
    .get(userId)
  if (!row) return { ok: false, error: 'Run setup first.' }
  if (row.enabled) return { ok: false, error: '2FA is already enabled.' }
  const totp = totpFromSecret(row.secret)
  const delta = totp.validate({ token: String(code ?? '').replace(/\s+/g, ''), window: 1 })
  if (delta == null) return { ok: false, error: 'Code did not match. Try again.' }
  db.prepare('UPDATE totp_secrets SET enabled = 1 WHERE user_id = ?').run(userId)
  return { ok: true }
}

export async function disableTwoFactor(userId, currentPassword) {
  const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
  if (!userRow) return { ok: false, error: 'User not found.' }
  const match = await bcrypt.compare(currentPassword || '', userRow.password_hash)
  if (!match) return { ok: false, error: 'Incorrect password.' }
  db.prepare('DELETE FROM totp_secrets WHERE user_id = ?').run(userId)
  return { ok: true }
}

export function userRequiresTwoFactor(userId) {
  const row = db
    .prepare('SELECT enabled FROM totp_secrets WHERE user_id = ?')
    .get(userId)
  return Boolean(row?.enabled)
}

export function issueChallengeToken(userId, email) {
  return jwt.sign(
    { sub: userId, email, kind: 'totp_challenge' },
    jwtSecret(),
    { expiresIn: CHALLENGE_TTL_SECONDS },
  )
}

export function verifyChallengeToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret())
    if (payload.kind !== 'totp_challenge') return null
    return payload
  } catch {
    return null
  }
}

export function issueAuthToken(userId, email) {
  return jwt.sign({ sub: userId, email }, jwtSecret(), { expiresIn: TOKEN_TTL })
}

/**
 * Verify a 6-digit TOTP code or a one-time backup code. Backup codes are
 * removed from the stored list on success so each is single-use.
 */
export async function verifyTotpCode(userId, rawCode) {
  const code = String(rawCode ?? '').replace(/\s+/g, '')
  if (!code) return { ok: false, error: 'Enter your verification code.' }
  const row = db
    .prepare('SELECT secret, backup_codes_json, enabled FROM totp_secrets WHERE user_id = ?')
    .get(userId)
  if (!row || !row.enabled) return { ok: false, error: 'Two-factor is not enabled.' }

  // Try TOTP first.
  if (/^\d{6}$/.test(code)) {
    const totp = totpFromSecret(row.secret)
    const delta = totp.validate({ token: code, window: 1 })
    if (delta != null) return { ok: true, used: 'totp' }
  }

  // Otherwise try a backup code.
  const remaining = JSON.parse(row.backup_codes_json || '[]')
  for (let i = 0; i < remaining.length; i++) {
    const match = await bcrypt.compare(code, remaining[i])
    if (match) {
      const next = remaining.slice(0, i).concat(remaining.slice(i + 1))
      db.prepare('UPDATE totp_secrets SET backup_codes_json = ? WHERE user_id = ?').run(
        JSON.stringify(next),
        userId,
      )
      return { ok: true, used: 'backup', remaining: next.length }
    }
  }

  return { ok: false, error: 'Invalid code. Check the app and try again.' }
}
